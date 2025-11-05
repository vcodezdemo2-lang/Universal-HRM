import {
  users,
  leads,
  leadHistory,
  uploads,
  notifications,
  type User,
  type UpsertUser,
  type Lead,
  type InsertLead,
  type LeadHistory,
  type InsertLeadHistory,
  type Upload,
  type InsertUpload,
  type Notification,
  type InsertNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql, inArray, like, or, gte, lte, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: Omit<UpsertUser, 'id'>): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getUsersByRole(role: string): Promise<User[]>;
  
  // Lead operations
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: Partial<Lead>): Promise<Lead>;
  deleteLead(id: number): Promise<void>;
  deleteLeadWithHistory(leadId: number, historyData: Omit<InsertLeadHistory, 'leadId'>): Promise<void>;
  unassignLeadWithHistory(leadId: number, historyData: Omit<InsertLeadHistory, 'leadId'>): Promise<Lead>;
  getLead(id: number): Promise<Lead | undefined>;
  getLeadsByOwner(ownerId: string): Promise<Lead[]>;
  getLeadsByStatus(status: string): Promise<Lead[]>;
  assignLead(leadId: number, toUserId: string, changedByUserId: string, reason?: string): Promise<Lead>;
  checkEmailExists(email: string): Promise<boolean>;
  searchLeads(filters: {
    status?: string;
    ownerId?: string;
    accountsId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    limit?: number;
    unassigned?: boolean;
    excludeCompleted?: boolean;
    previousOwnerId?: string;
    includeHistory?: boolean;
  }): Promise<{ leads: Lead[]; total: number; }>;
  
  // Lead history operations
  createLeadHistory(history: InsertLeadHistory): Promise<LeadHistory>;
  getLeadHistory(leadId: number): Promise<LeadHistory[]>;
  
  // Upload operations
  createUpload(upload: InsertUpload): Promise<Upload>;
  updateUpload(id: number, updates: Partial<Upload>): Promise<Upload>;
  getUploadsByUser(userId: string): Promise<Upload[]>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: number): Promise<void>;
  
  // Analytics operations
  getLeadMetrics(): Promise<{
    totalLeads: number;
    activeHR: number;
    completed: number;
    statusDistribution: Record<string, number>;
  }>;
  
  // Export operations
  getLeadsWithUserInfo(filters: {
    status?: string;
    ownerId?: string;
    accountsId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          role: userData.role,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: Omit<UpsertUser, 'id'>): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(and(
      eq(users.role, role as any),
      eq(users.isActive, true)
    ));
  }

  // Lead operations
  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async updateLead(id: number, updates: Partial<Lead>): Promise<Lead> {
    // Sanitize empty strings to null for date/optional fields
    const sanitizedUpdates = { ...updates };
    
    // Convert empty strings to null for specific fields
    if (sanitizedUpdates.walkinDate === '') sanitizedUpdates.walkinDate = null;
    if (sanitizedUpdates.walkinTime === '') sanitizedUpdates.walkinTime = null;
    if (sanitizedUpdates.phone === '') sanitizedUpdates.phone = null;
    if (sanitizedUpdates.domain === '') sanitizedUpdates.domain = null;
    if (sanitizedUpdates.notes === '') sanitizedUpdates.notes = null;
    if (sanitizedUpdates.sessionDays === '') sanitizedUpdates.sessionDays = null;
    if (sanitizedUpdates.timing === '') sanitizedUpdates.timing = null;
    // Dynamic fields from bulk import
    if (sanitizedUpdates.yearOfPassing === '') sanitizedUpdates.yearOfPassing = null;
    if (sanitizedUpdates.collegeName === '') sanitizedUpdates.collegeName = null;
    // HR workflow field - registrationAmount is already handled in routes.ts
    if (sanitizedUpdates.registrationAmount === '') sanitizedUpdates.registrationAmount = null;

    const [lead] = await db
      .update(leads)
      .set({ ...sanitizedUpdates, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return lead;
  }

  async deleteLead(id: number): Promise<void> {
    await db.delete(leads).where(eq(leads.id, id));
  }

  async deleteLeadWithHistory(leadId: number, historyData: Omit<InsertLeadHistory, 'leadId'>): Promise<void> {
    await db.transaction(async (tx) => {
      // Create final history entry for the deletion
      await tx.insert(leadHistory).values({
        ...historyData,
        leadId: leadId
      });
      
      // Delete all existing lead history records for this lead (to avoid foreign key constraint)
      await tx.delete(leadHistory).where(eq(leadHistory.leadId, leadId));
      
      // Finally delete the lead
      await tx.delete(leads).where(eq(leads.id, leadId));
    });
  }

  async unassignLeadWithHistory(leadId: number, historyData: Omit<InsertLeadHistory, 'leadId'>): Promise<Lead> {
    return await db.transaction(async (tx) => {
      // Create history entry first
      await tx.insert(leadHistory).values({
        ...historyData,
        leadId: leadId
      });
      
      // Unassign the lead by setting currentOwnerId to null and reset status to 'new'
      const [unassignedLead] = await tx
        .update(leads)
        .set({ 
          currentOwnerId: null,
          status: 'new',
          updatedAt: new Date()
        })
        .where(eq(leads.id, leadId))
        .returning();
      
      return unassignedLead;
    });
  }

  async checkEmailExists(email: string): Promise<boolean> {
    if (!email || email.trim() === '') {
      return false;
    }
    
    const trimmedEmail = email.trim();
    
    try {
      const result = await db
        .select({ id: leads.id })
        .from(leads)
        .where(sql`LOWER(${leads.email}) = LOWER(${trimmedEmail})`)
        .limit(1);
      
      return result.length > 0;
    } catch (error) {
      console.error(`Error checking email existence for ${trimmedEmail}:`, error);
      return false;
    }
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async getLeadsByOwner(ownerId: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.currentOwnerId, ownerId));
  }

  async getLeadsByStatus(status: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.status, status));
  }

  async assignLead(leadId: number, toUserId: string, changedByUserId: string, reason?: string): Promise<Lead> {
    return await db.transaction(async (tx) => {
      // Get the current lead and check if it's available for assignment
      const [currentLead] = await tx.select().from(leads).where(eq(leads.id, leadId));
      
      if (!currentLead) {
        throw new Error("Lead not found");
      }

      const previousOwnerId = currentLead.currentOwnerId;

      // Determine if this is an HR self-assignment (requires unassigned lead)
      const isHRSelfAssign = toUserId === changedByUserId && previousOwnerId === null;
      
      // For HR self-assignment, use atomic update with condition to prevent race conditions
      if (isHRSelfAssign) {
        const result = await tx
          .update(leads)
          .set({ 
            currentOwnerId: toUserId,
            updatedAt: new Date() 
          })
          .where(and(eq(leads.id, leadId), isNull(leads.currentOwnerId)))
          .returning();
          
        if (result.length === 0) {
          // Lead was already assigned by another HR user
          throw new Error("Lead is already assigned to another user");
        }
        
        const [updatedLead] = result;

        // Create history entry for the assignment
        await tx.insert(leadHistory).values({
          leadId: leadId,
          fromUserId: previousOwnerId,
          toUserId: toUserId,
          previousStatus: currentLead.status,
          newStatus: currentLead.status, // Status remains the same
          changeReason: reason || "Lead assigned",
          changeData: { 
            action: "assignment",
            previousOwner: previousOwnerId,
            newOwner: toUserId 
          },
          changedByUserId: changedByUserId,
        });

        return updatedLead;
      } else {
        // For manager/admin reassignments, allow unconditional updates
        const [updatedLead] = await tx
          .update(leads)
          .set({ 
            currentOwnerId: toUserId,
            updatedAt: new Date() 
          })
          .where(eq(leads.id, leadId))
          .returning();

        // Create history entry for the assignment
        await tx.insert(leadHistory).values({
          leadId: leadId,
          fromUserId: previousOwnerId,
          toUserId: toUserId,
          previousStatus: currentLead.status,
          newStatus: currentLead.status, // Status remains the same
          changeReason: reason || "Lead assigned",
          changeData: { 
            action: "assignment",
            previousOwner: previousOwnerId,
            newOwner: toUserId 
          },
          changedByUserId: changedByUserId,
        });

        return updatedLead;
      }
    });
  }

  async searchLeads(filters: {
    status?: string;
    ownerId?: string;
    accountsId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    limit?: number;
    unassigned?: boolean;
    excludeCompleted?: boolean;
    previousOwnerId?: string;
    includeHistory?: boolean;
    showAllCompleted?: boolean;
  }): Promise<{ leads: any[]; total: number; }> {
    const { status, ownerId, accountsId, fromDate, toDate, search, page = 1, limit = 20, unassigned, excludeCompleted, previousOwnerId, includeHistory, showAllCompleted } = filters;
    
    // Join with users table to get current owner details
    let query = db.select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      location: leads.location,
      degree: leads.degree,
      domain: leads.domain,
      sessionDays: leads.sessionDays,
      walkinDate: leads.walkinDate,
      walkinTime: leads.walkinTime,
      timing: leads.timing,
      currentOwnerId: leads.currentOwnerId,
      sourceManagerId: leads.sourceManagerId,
      status: leads.status,
      isActive: leads.isActive,
      notes: leads.notes,
      yearOfPassing: leads.yearOfPassing,
      collegeName: leads.collegeName,
      registrationAmount: leads.registrationAmount,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      // Include current owner details
      currentOwner: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        username: users.username
      }
    })
    .from(leads)
    .leftJoin(users, eq(leads.currentOwnerId, users.id));
    
    let countQuery = db.select({ count: count().as('count') }).from(leads);
    
    const conditions = [];
    
    if (status) {
      conditions.push(eq(leads.status, status));
    }
    
    // Handle excludeCompleted filter for HR "My Leads"
    if (excludeCompleted) {
      conditions.push(sql`${leads.status} != 'completed'`);
    }
    
    // Handle special unassigned filter for HR users
    if (unassigned) {
      conditions.push(isNull(leads.currentOwnerId));
    } else {
      // Handle owner filtering - hrId and accountsId are mutually exclusive
      if (ownerId && accountsId) {
        // If both are provided, use OR logic to find leads owned by either
        conditions.push(
          or(
            eq(leads.currentOwnerId, ownerId),
            eq(leads.currentOwnerId, accountsId)
          )
        );
      } else if (ownerId) {
        conditions.push(eq(leads.currentOwnerId, ownerId));
      } else if (accountsId) {
        conditions.push(eq(leads.currentOwnerId, accountsId));
      }
    }
    
    // Handle previousOwnerId filter for completed leads (find leads completed by specific HR user)
    // OR showAllCompleted for managers to see all completed leads  
    if (previousOwnerId || showAllCompleted) {
      try {
        let completedLeadIds;
        
        if (showAllCompleted) {
          // Manager access - show all completed leads by any HR user
          console.log('Manager access: searching for all completed leads by any HR user');
          completedLeadIds = await db
            .select({ leadId: leadHistory.leadId })
            .from(leadHistory)
            .where(eq(leadHistory.newStatus, 'completed'));
        } else {
          // HR access - show only leads completed by this specific user
          console.log(`HR access: searching for completed leads by previousOwnerId: ${previousOwnerId}`);
          completedLeadIds = await db
            .select({ leadId: leadHistory.leadId })
            .from(leadHistory)
            .where(and(
              previousOwnerId ? eq(leadHistory.fromUserId, previousOwnerId) : sql`true`,
              eq(leadHistory.newStatus, 'completed')
            ));
        }
        
        console.log(`Found ${completedLeadIds.length} completed lead history entries:`, completedLeadIds);
        
        const leadIds = completedLeadIds.map(row => row.leadId);
        if (leadIds.length > 0) {
          console.log(`Adding filter for lead IDs: ${leadIds.join(', ')}`);
          conditions.push(inArray(leads.id, leadIds));
        } else {
          // No leads found, return empty result
          console.log('No completed leads found, returning empty result');
          return { leads: [], total: 0 };
        }
      } catch (error) {
        console.error('Error fetching completed leads:', error);
        return { leads: [], total: 0 };
      }
    }
    
    if (fromDate) {
      conditions.push(gte(leads.createdAt, new Date(fromDate)));
    }
    
    if (toDate) {
      // Include end of day for toDate to make it inclusive
      const endOfDay = new Date(toDate + 'T23:59:59.999Z');
      conditions.push(lte(leads.createdAt, endOfDay));
    }
    
    if (search) {
      conditions.push(
        or(
          like(leads.name, `%${search}%`),
          like(leads.email, `%${search}%`),
          like(leads.phone, `%${search}%`)
        )
      );
    }
    
    if (conditions.length > 0) {
      const whereClause = and(...conditions);
      query = query.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }
    
    const [leadsResult, totalResult] = await Promise.all([
      query.limit(limit).offset((page - 1) * limit).orderBy(desc(leads.updatedAt)),
      countQuery
    ]);
    
    // Fix null handling: set currentOwner to null when there's no user match
    const processedLeads = leadsResult.map(lead => ({
      ...lead,
      currentOwner: lead.currentOwner?.id ? lead.currentOwner : null
    }));
    
    return {
      leads: processedLeads,
      total: totalResult[0].count
    };
  }

  // Lead history operations
  async createLeadHistory(history: InsertLeadHistory): Promise<LeadHistory> {
    const [newHistory] = await db.insert(leadHistory).values(history).returning();
    return newHistory;
  }

  async getLeadHistory(leadId: number): Promise<LeadHistory[]> {
    return await db
      .select()
      .from(leadHistory)
      .where(eq(leadHistory.leadId, leadId))
      .orderBy(desc(leadHistory.changedAt));
  }

  // Upload operations
  async createUpload(upload: InsertUpload): Promise<Upload> {
    const [newUpload] = await db.insert(uploads).values(upload).returning();
    return newUpload;
  }

  async updateUpload(id: number, updates: Partial<Upload>): Promise<Upload> {
    const [upload] = await db
      .update(uploads)
      .set(updates)
      .where(eq(uploads.id, id))
      .returning();
    return upload;
  }

  async getUploadsByUser(userId: string): Promise<Upload[]> {
    return await db
      .select()
      .from(uploads)
      .where(eq(uploads.uploaderId, userId))
      .orderBy(desc(uploads.uploadedAt));
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  // Analytics operations
  async getLeadMetrics(): Promise<{
    totalLeads: number;
    activeHR: number;
    completed: number;
    statusDistribution: Record<string, number>;
  }> {
    const [totalLeadsResult] = await db
      .select({ count: count() })
      .from(leads);
    
    const [activeHRResult] = await db
      .select({ count: count() })
      .from(leads)
      .where(and(
        eq(leads.isActive, true),
        inArray(leads.status, ['new', 'scheduled', 'not_available', 'reschedule'])
      ));
    
    const [completedResult] = await db
      .select({ count: count() })
      .from(leads)
      .where(eq(leads.status, 'completed'));
    
    const statusDistributionResult = await db
      .select({
        status: leads.status,
        count: count()
      })
      .from(leads)
      .groupBy(leads.status);
    
    const statusDistribution: Record<string, number> = {};
    statusDistributionResult.forEach(row => {
      statusDistribution[row.status] = row.count;
    });
    
    return {
      totalLeads: totalLeadsResult.count,
      activeHR: activeHRResult.count,
      completed: completedResult.count,
      statusDistribution
    };
  }
  
  // Export operations - get leads with user information
  async getLeadsWithUserInfo(filters: {
    status?: string;
    ownerId?: string;
    accountsId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<any[]> {
    const { status, ownerId, accountsId, fromDate, toDate, limit = 10000 } = filters;
    
    // Get leads first, then fetch user info separately to avoid complex joins
    const searchResult = await this.searchLeads({ 
      status, 
      ownerId, 
      accountsId, 
      fromDate, 
      toDate, 
      limit 
    });
    
    const leadsWithUsers = [];
    
    for (const lead of searchResult.leads) {
      // Get current owner info
      let hrName = null;
      let accountsHandlerName = null;
      if (lead.currentOwnerId) {
        const currentOwner = await this.getUser(lead.currentOwnerId);
        if (currentOwner) {
          const fullName = `${currentOwner.firstName || ''} ${currentOwner.lastName || ''}`.trim();
          if (currentOwner.role === 'hr') {
            hrName = fullName;
          } else if (currentOwner.role === 'accounts') {
            accountsHandlerName = fullName;
          }
        }
      }
      
      // Get manager info
      let managerName = null;
      if (lead.sourceManagerId) {
        const manager = await this.getUser(lead.sourceManagerId);
        if (manager) {
          managerName = `${manager.firstName || ''} ${manager.lastName || ''}`.trim();
        }
      }
      
      leadsWithUsers.push({
        ...lead,
        hrName,
        accountsHandlerName,
        managerName
      });
    }
    
    return leadsWithUsers;
  }
}

export const storage = new DatabaseStorage();

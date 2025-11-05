import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, getSession } from "./auth";
import { z } from "zod";
import { insertLeadSchema, insertUserSchema, insertLeadHistorySchema } from "@shared/schema";
import multer from "multer";
import xlsx from "xlsx";
import * as bcrypt from "bcrypt";
import session from "express-session";
import connectPg from "connect-pg-simple";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Handle hardcoded manager
      if (userId === 'hardcoded-manager-id') {
        return res.json({
          id: 'hardcoded-manager-id',
          email: 'vcodezmanager@gmail.com',
          firstName: 'VCodez',
          lastName: 'Manager',
          role: 'manager',
          fullName: 'VCodez Manager',
          isActive: true
        });
      }
      
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Password-based login route
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Hardcoded manager login
      if (email === 'vcodezmanager@gmail.com' && password === 'VCodezhrm@2025') {
        (req as any).session.user = {
          id: 'hardcoded-manager-id',
          email: email,
          role: 'manager',
          loginType: 'password'
        };

        console.log(`Hardcoded manager login successful for: ${email}`);

        return res.json({
          success: true,
          user: {
            id: 'hardcoded-manager-id',
            email: email,
            firstName: 'VCodez',
            lastName: 'Manager',
            role: 'manager',
            fullName: 'VCodez Manager'
          }
        });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check if user has a password hash (for traditional login)
      if (!user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ message: "Account is disabled. Contact your manager." });
      }

      // Create session for password-based login
      (req as any).session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        loginType: 'password'
      };

      console.log(`Password login successful for: ${email} (role: ${user.role})`);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          fullName: user.fullName
        }
      });
    } catch (error) {
      console.error("Password login error:", error);
      res.status(500).json({ message: "Login failed. Please try again." });
    }
  });

  // User management routes (Manager only)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Handle hardcoded manager
      let userRole = 'hr';
      if (userId === 'hardcoded-manager-id') {
        userRole = 'manager';
      } else {
        const currentUser = await storage.getUser(userId);
        userRole = currentUser?.role || 'hr';
      }
      
      const { role } = req.query;
      let users;
      
      if (userRole === 'manager') {
        // Managers can see all users
        if (role) {
          users = await storage.getUsersByRole(role as string);
        } else {
          const hrUsers = await storage.getUsersByRole('hr');
          const accountsUsers = await storage.getUsersByRole('accounts');
          const adminUsers = await storage.getUsersByRole('admin');
          users = [...hrUsers, ...accountsUsers, ...adminUsers];
        }
      } else if (userRole === 'hr') {
        // HR users can only see other HR users (for lead assignment)
        if (role === 'hr' || !role) {
          users = await storage.getUsersByRole('hr');
        } else {
          return res.status(403).json({ message: "HR users can only access HR user list" });
        }
      } else {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Handle hardcoded manager
      let userRole = 'hr';
      if (userId === 'hardcoded-manager-id') {
        userRole = 'manager';
      } else {
        const currentUser = await storage.getUser(userId);
        userRole = currentUser?.role || 'hr';
      }
      
      if (userRole !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const createUserSchema = insertUserSchema.extend({
        fullName: z.string(),
        role: z.enum(['hr', 'accounts', 'admin']),
        password: z.string().min(6).optional() // Make password optional for auto-generation
      });

      const validatedData = createUserSchema.parse(req.body);
      
      // Auto-generate secure password for staff accounts
      const generatePassword = () => {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
      };

      const plainPassword = validatedData.password || generatePassword();
      const passwordHash = await bcrypt.hash(plainPassword, 10);
      
      const user = await storage.createUser({
        ...validatedData,
        passwordHash,
        firstName: validatedData.fullName.split(' ')[0],
        lastName: validatedData.fullName.split(' ').slice(1).join(' '),
        isActive: true
      });

      // Broadcast user creation to managers and admins only
      if (typeof (global as any).broadcastUpdate === 'function') {
        (global as any).broadcastUpdate('user_created', {
          id: user.id,
          fullName: validatedData.fullName,
          role: user.role,
          createdBy: req.user.claims.sub
        }, {
          roles: ['manager', 'admin'] // Only managers and admins see user creation
        });
      }

      console.log(`New user created: ${user.email} (${user.role}) with password: ${plainPassword}`);

      res.json({
        ...user,
        tempPassword: plainPassword, // Include generated password in response
        passwordNote: "Share this password securely with the user. They can log in at /login"
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Handle hardcoded manager
      let userRole = 'hr';
      if (userId === 'hardcoded-manager-id') {
        userRole = 'manager';
      } else {
        const currentUser = await storage.getUser(userId);
        userRole = currentUser?.role || 'hr';
      }
      
      if (userRole !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      const updates = req.body;
      
      const user = await storage.updateUser(id, updates);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Handle hardcoded manager
      let userRole = 'hr';
      if (userId === 'hardcoded-manager-id') {
        userRole = 'manager';
      } else {
        const currentUser = await storage.getUser(userId);
        userRole = currentUser?.role || 'hr';
      }
      
      if (userRole !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { id } = req.params;
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Lead management routes
  app.get('/api/leads/recent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      const userRole = currentUser?.role || 'hr';
      
      let filters: any = { 
        page: 1, 
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc' 
      };
      
      // Role-based filtering for recent activity
      if (userRole === 'hr') {
        filters.ownerId = userId;
      } else if (userRole === 'accounts') {
        filters.status = 'pending';
      }
      
      const result = await storage.searchLeads(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching recent leads:", error);
      res.status(500).json({ message: "Failed to fetch recent leads" });
    }
  });

  app.get('/api/leads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      const userRole = currentUser?.role || 'hr';
      const { status, search, page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      
      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({ message: "Invalid pagination parameters" });
      }
      
      let filters: any = { page: pageNum, limit: limitNum };
      
      if (status) filters.status = status;
      if (search) filters.search = search;
      
      // Role-based filtering
      if (userRole === 'hr') {
        // HR users see only unassigned leads in Lead Management (so they can claim them)
        filters.unassigned = true;
      } else if (userRole === 'accounts') {
        filters.status = filters.status || 'pending';
      }
      // Managers and admins see all leads
      
      const result = await storage.searchLeads(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get('/api/leads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const leadId = parseInt(id);
      
      if (isNaN(leadId)) {
        return res.status(400).json({ message: "Invalid lead ID" });
      }
      
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.put('/api/leads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      const userRole = currentUser?.role || 'hr';
      const { id } = req.params;
      
      // Validate request body based on user role
      const baseUpdateSchema = z.object({
        status: z.enum(['new', 'scheduled', 'completed', 'not_interested', 'pending', 'ready_for_class', 'not_available', 'no_show', 'reschedule', 'pending_but_ready']).optional(),
        notes: z.string().optional(),
        changeReason: z.string().optional(),
        // Dynamic fields from bulk import - HR can edit these
        yearOfPassing: z.string().optional().or(z.literal("")),
        collegeName: z.string().optional().or(z.literal("")),
        // HR workflow fields
        registrationAmount: z.string().optional().or(z.literal("")),
        pendingAmount: z.string().optional().or(z.literal(""))
      });

      // Managers and admins can update all fields
      const managerUpdateSchema = baseUpdateSchema.extend({
        name: z.string().min(1, "Name is required").optional(),
        email: z.string().email("Valid email is required").optional(),
        phone: z.string().optional(),
        location: z.string().optional(),
        degree: z.string().optional(),
        domain: z.string().optional(),
        sessionDays: z.enum(["M,W,F", "T,T,S", "daily", "weekend", "custom"]).optional().or(z.literal("")),
        timing: z.string().optional(),
        walkinDate: z.string().optional(),
        walkinTime: z.string().optional()
      });

      const updateLeadSchema = (userRole === 'manager' || userRole === 'admin') ? managerUpdateSchema : baseUpdateSchema;
      
      const validation = updateLeadSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid request body',
          details: validation.error.errors 
        });
      }
      
      const updates = validation.data;
      
      // Parse registrationAmount from string to decimal (null for empty)
      if (updates.registrationAmount !== undefined) {
        if (updates.registrationAmount === "" || updates.registrationAmount === null) {
          updates.registrationAmount = null as any;
        } else {
          const parsed = parseFloat(updates.registrationAmount);
          if (isNaN(parsed)) {
            return res.status(400).json({ message: "Invalid registration amount format" });
          }
          updates.registrationAmount = parsed.toString() as any; // Store as string for Drizzle decimal handling
        }
      }
      
      // Parse pendingAmount from string to decimal (null for empty)
      if (updates.pendingAmount !== undefined) {
        if (updates.pendingAmount === "" || updates.pendingAmount === null) {
          updates.pendingAmount = null as any;
        } else {
          const parsed = parseFloat(updates.pendingAmount);
          if (isNaN(parsed)) {
            return res.status(400).json({ message: "Invalid pending amount format" });
          }
          updates.pendingAmount = parsed.toString() as any; // Store as string for Drizzle decimal handling
        }
      }
      
      const leadId = parseInt(id);
      if (isNaN(leadId)) {
        return res.status(400).json({ message: "Invalid lead ID" });
      }

      const currentLead = await storage.getLead(leadId);
      if (!currentLead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Role-based access control
      // Managers and admins can edit any lead
      // HR users can only edit their own assigned leads
      // Accounts users can only edit leads assigned to them (completed leads from HR)
      if (userRole === 'accounts' && currentLead.currentOwnerId !== userId) {
        return res.status(403).json({ message: "Access denied: You can only edit leads assigned to you" });
      }
      
      if (userRole === 'hr' && currentLead.currentOwnerId !== userId) {
        return res.status(403).json({ message: "Access denied: You can only edit your own assigned leads" });
      }

      const lead = await storage.updateLead(leadId, updates);

      // Create history entry for status changes
      if (updates.status && updates.status !== currentLead.status) {
        await storage.createLeadHistory({
          leadId: leadId,
          fromUserId: currentLead.currentOwnerId,
          toUserId: currentLead.currentOwnerId,
          previousStatus: currentLead.status,
          newStatus: updates.status,
          changeReason: updates.changeReason || 'Status updated',
          changeData: JSON.stringify({ updates }),
          changedByUserId: userId
        });

        // Handle status transitions
        if (updates.status === 'completed') {
          // HR completes → assign to Accounts as pending
          if (userRole === 'hr') {
            const accountsUsers = await storage.getUsersByRole('accounts');
            if (accountsUsers.length > 0) {
              const assignedUser = accountsUsers[0]; // Simple round-robin can be improved
              
              // Update lead assignment and status
              await storage.updateLead(leadId, {
                currentOwnerId: assignedUser.id,
                status: 'pending',
                isActive: true
              });

              // Create audit trail for the handoff (reassignment)
              await storage.createLeadHistory({
                leadId: leadId,
                fromUserId: currentLead.currentOwnerId,
                toUserId: assignedUser.id,
                previousStatus: 'completed',
                newStatus: 'pending',
                changeReason: 'Lead completed by HR and forwarded to Accounts team',
                changeData: JSON.stringify({ 
                  handoffType: 'HR_to_Accounts',
                  previousOwner: currentLead.currentOwnerId,
                  newOwner: assignedUser.id 
                }),
                changedByUserId: userId
              });

              // Create notification
              await storage.createNotification({
                userId: assignedUser.id,
                title: 'New Lead Assigned',
                message: `Lead ${lead.name} has been forwarded from HR`,
                type: 'lead_assignment',
                relatedLeadId: parseInt(id)
              });
            }
          }
          // Accounts completes → assign to Admin as completed  
          else if (userRole === 'accounts') {
            const adminUsers = await storage.getUsersByRole('admin');
            if (adminUsers.length > 0) {
              const assignedUser = adminUsers[0]; // Simple round-robin can be improved
              
              // Update lead assignment (keep status as completed)
              await storage.updateLead(leadId, {
                currentOwnerId: assignedUser.id,
                status: 'completed',
                isActive: true
              });

              // Create audit trail for the handoff (reassignment)
              await storage.createLeadHistory({
                leadId: leadId,
                fromUserId: currentLead.currentOwnerId,
                toUserId: assignedUser.id,
                previousStatus: 'completed',
                newStatus: 'completed',
                changeReason: 'Lead completed by Accounts and forwarded to Admin',
                changeData: JSON.stringify({ 
                  handoffType: 'Accounts_to_Admin',
                  previousOwner: currentLead.currentOwnerId,
                  newOwner: assignedUser.id 
                }),
                changedByUserId: userId
              });

              // Create notification
              await storage.createNotification({
                userId: assignedUser.id,
                title: 'Completed Lead Assigned',
                message: `Lead ${lead.name} has been completed by Accounts and assigned to you`,
                type: 'lead_assignment',
                relatedLeadId: parseInt(id)
              });
            }
          }
        }
      } else {
        // Create history entry for non-status field changes (for manager/admin edits)
        const changedFields = [];
        const nonStatusFields = ['name', 'email', 'phone', 'location', 'degree', 'domain', 'sessionDays', 'timing', 'walkinDate', 'walkinTime', 'notes'];
        
        for (const field of nonStatusFields) {
          const updateValue = (updates as any)[field];
          const currentValue = (currentLead as any)[field];
          if (updateValue !== undefined && updateValue !== currentValue) {
            changedFields.push({
              field,
              oldValue: currentValue,
              newValue: updateValue
            });
          }
        }

        if (changedFields.length > 0) {
          await storage.createLeadHistory({
            leadId: leadId,
            fromUserId: currentLead.currentOwnerId,
            toUserId: currentLead.currentOwnerId,
            previousStatus: currentLead.status,
            newStatus: currentLead.status,
            changeReason: updates.changeReason || 'Lead information updated',
            changeData: JSON.stringify({ changedFields, updates }),
            changedByUserId: userId
          });
        }
      }

      // Get final lead state for accurate broadcast
      const finalLead = await storage.getLead(leadId);
      
      // Broadcast real-time update with role-based filtering
      if (typeof (global as any).broadcastUpdate === 'function' && finalLead) {
        (global as any).broadcastUpdate('lead_updated', {
          id: finalLead.id,
          name: finalLead.name,
          status: finalLead.status,
          updatedBy: userId
        }, {
          roles: ['hr', 'accounts', 'admin', 'manager'] // Only authenticated roles
        });
      }

      res.json(finalLead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  // Lead deletion route
  app.delete('/api/leads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      const userRole = currentUser?.role || 'hr';
      const { id } = req.params;
      
      const leadId = parseInt(id);
      if (isNaN(leadId)) {
        return res.status(400).json({ message: "Invalid lead ID" });
      }

      const currentLead = await storage.getLead(leadId);
      if (!currentLead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Role-based access control
      // Managers and admins can delete any lead
      // HR users can only delete their own assigned leads
      if (userRole === 'hr' && currentLead.currentOwnerId !== userId) {
        return res.status(403).json({ message: "Access denied: You can only delete your own leads" });
      }
      
      if (userRole === 'accounts') {
        return res.status(403).json({ message: "Access denied: Accounts users cannot delete leads" });
      }

      // Different behavior based on user role:
      // HR users: Unassign lead (soft delete) - lead goes back to Lead Management
      // Managers/Admins: Hard delete lead permanently
      if (userRole === 'hr' && currentLead.currentOwnerId === userId) {
        // HR user deleting their own lead - unassign it instead of deleting
        await storage.unassignLeadWithHistory(leadId, {
          fromUserId: currentLead.currentOwnerId,
          toUserId: null,
          previousStatus: currentLead.status,
          newStatus: 'new', // Reset to new status for reassignment
          changeReason: 'Lead released by HR - returned to Lead Management',
          changeData: { 
            action: 'unassigned',
            previousOwner: currentLead.currentOwnerId,
            releasedBy: userId,
            releasedAt: new Date()
          },
          changedByUserId: userId
        });

        // Broadcast real-time update for lead unassignment
        if (typeof (global as any).broadcastUpdate === 'function') {
          (global as any).broadcastUpdate('lead_unassigned', {
            id: leadId,
            name: currentLead.name,
            releasedBy: userId
          }, {
            roles: ['hr', 'accounts', 'admin', 'manager'] // Only authenticated roles
          });
        }

        res.json({ success: true, message: "Lead returned to Lead Management for reassignment" });
      } else {
        // Manager/Admin hard delete
        await storage.deleteLeadWithHistory(leadId, {
          fromUserId: currentLead.currentOwnerId,
          toUserId: null,
          previousStatus: currentLead.status,
          newStatus: currentLead.status, // Keep original status for audit trail
          changeReason: 'Lead deleted',
          changeData: { 
            action: 'deleted',
            deletedLead: currentLead,
            deletedBy: userId,
            deletedAt: new Date()
          },
          changedByUserId: userId
        });
        
        // Broadcast real-time update for lead deletion
        if (typeof (global as any).broadcastUpdate === 'function') {
          (global as any).broadcastUpdate('lead_deleted', {
            id: leadId,
            name: currentLead.name,
            deletedBy: userId
          }, {
            roles: ['hr', 'accounts', 'admin', 'manager'] // Only authenticated roles
          });
        }

        res.json({ success: true, message: "Lead deleted successfully" });
      }
    } catch (error) {
      console.error("Error deleting lead:", error);
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });

  // Lead assignment routes
  app.post('/api/leads/:id/assign', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const leadId = parseInt(id);
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (!currentUser) {
        return res.status(403).json({ message: "User not found" });
      }
      
      const userRole = currentUser.role;
      
      if (!leadId || isNaN(leadId)) {
        return res.status(400).json({ message: "Invalid lead ID" });
      }

      // Validate request body
      const assignLeadSchema = z.object({
        toUserId: z.string().optional(),
        reason: z.string().max(256).optional()
      });
      
      const validation = assignLeadSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid request body',
          details: validation.error.errors 
        });
      }
      
      const { toUserId, reason } = validation.data;
      
      // Default to current user if no toUserId provided
      const targetUserId = toUserId || userId;
      
      // Validate target user exists and is valid for the assignment
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(400).json({ message: "Target user not found" });
      }

      // Role-based authorization
      if (userRole === 'hr') {
        // HR can only assign leads to themselves and only if the lead is unassigned
        if (targetUserId !== userId) {
          return res.status(403).json({ message: "HR users can only assign leads to themselves" });
        }
        
        const existingLead = await storage.getLead(leadId);
        if (!existingLead) {
          return res.status(404).json({ message: "Lead not found" });
        }
        
        if (existingLead.currentOwnerId) {
          return res.status(409).json({ message: "Lead is already assigned" });
        }
      } else if (userRole === 'manager' || userRole === 'admin') {
        // Managers and admins can reassign to any HR user
        if (targetUser.role !== 'hr' && targetUserId !== userId) {
          return res.status(400).json({ message: "Can only assign leads to HR users" });
        }
      } else {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Use atomic assignment with concurrency protection
      let updatedLead;
      try {
        updatedLead = await storage.assignLead(leadId, targetUserId, userId, reason);
      } catch (error: any) {
        if (error.message.includes('Lead not found')) {
          return res.status(404).json({ message: "Lead not found" });
        }
        if (error.message.includes('already assigned')) {
          return res.status(409).json({ message: "Lead is already assigned to another user" });
        }
        throw error;
      }
      
      // Broadcast assignment to relevant users
      if (typeof (global as any).broadcastUpdate === 'function') {
        (global as any).broadcastUpdate('lead_assigned', {
          leadId,
          assignedTo: targetUserId,
          assignedBy: userId,
          lead: updatedLead
        }, {
          userIds: [targetUserId] // Notify the user who got the lead
        });
      }

      res.json({ success: true, lead: updatedLead });
    } catch (error) {
      console.error("Error assigning lead:", error);
      res.status(500).json({ message: "Failed to assign lead" });
    }
  });

  // My leads route for HR and accounts users
  app.get('/api/my/leads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (!currentUser || !currentUser.role) {
        return res.status(403).json({ message: "Access denied - invalid user or role" });
      }
      
      const userRole = currentUser.role;
      
      // HR and accounts users can access their assigned leads
      if (userRole !== 'hr' && userRole !== 'accounts') {
        return res.status(403).json({ message: "This endpoint is for HR and accounts users only" });
      }

      const { status, search, page = 1, limit = 20 } = req.query;
      
      const filters = {
        ownerId: userId,
        status: status as string,
        search: search as string,
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 20,
        excludeCompleted: true // Exclude completed leads from My Leads
      };

      const result = await storage.searchLeads(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching my leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  // New endpoint for HR user's completed leads
  app.get('/api/my/completed', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      const userRole = currentUser?.role || 'hr';
      
      // Only HR, Accounts, Admin users and managers can access completed leads
      if (!['hr', 'accounts', 'admin', 'manager'].includes(userRole)) {
        return res.status(403).json({ message: "This endpoint is for HR, Accounts, Admin users and managers only" });
      }

      const { search, page = 1, limit = 20 } = req.query;
      
      const filters: any = {
        search: search as string,
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 20,
        includeHistory: true // Include lead history for detailed view
      };

      // Role-based filtering:
      // - HR users: see leads they personally completed
      // - Accounts users: see leads they personally completed  
      // - Managers and Admins: see all completed leads from any user (elevated access)
      if (userRole === 'hr') {
        filters.previousOwnerId = userId; // HR sees only their own completed leads
      } else if (userRole === 'accounts') {
        filters.previousOwnerId = userId; // Accounts sees only their own completed leads
      } else if (userRole === 'manager' || userRole === 'admin') {
        // Manager and Admin see all completed leads - don't set previousOwnerId filter
        // The storage logic will find any leads that were completed by any user
        filters.showAllCompleted = true; // Special flag for managers and admins
      }

      const result = await storage.searchLeads(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching completed leads:", error);
      res.status(500).json({ message: "Failed to fetch completed leads" });
    }
  });

  // Lead history routes
  app.get('/api/leads/:id/history', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub;
      const currentUser = await storage.getUser(userId);
      const userRole = currentUser?.role;
      
      // Get the lead to check ownership and access
      const lead = await storage.getLead(parseInt(id));
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Defensive check for valid roles
      if (!userRole || !['admin', 'manager', 'hr', 'accounts'].includes(userRole)) {
        return res.status(403).json({ message: "Access denied - invalid role" });
      }
      
      // Role-based access control for lead history
      if (userRole === 'admin' || userRole === 'manager') {
        // Admin and Manager have full access
      } else if (userRole === 'hr') {
        if (lead.currentOwnerId !== userId) {
          return res.status(403).json({ message: "Access denied - you can only view history for your assigned leads" });
        }
      } else if (userRole === 'accounts') {
        if (lead.currentOwnerId !== userId && lead.status !== 'pending') {
          return res.status(403).json({ message: "Access denied - you can only view history for your assigned leads or pending leads" });
        }
      } else {
        return res.status(403).json({ message: "Access denied - insufficient permissions" });
      }
      
      const history = await storage.getLeadHistory(parseInt(id));
      res.json(history);
    } catch (error) {
      console.error("Error fetching lead history:", error);
      res.status(500).json({ message: "Failed to fetch lead history" });
    }
  });

  // Individual lead creation - HR users can create leads and become the owner
  app.post('/api/leads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      const userRole = currentUser?.role;
      
      // Only HR users can create individual leads
      if (userRole !== 'hr') {
        return res.status(403).json({ message: "Only HR users can create individual leads" });
      }

      // Validate request body
      const validation = insertLeadSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: validation.error.errors 
        });
      }

      const leadData = validation.data;

      // Create the lead with the HR user as the owner
      const newLead = await storage.createLead({
        ...leadData,
        currentOwnerId: userId, // HR user who creates the lead becomes the owner
        sourceManagerId: userId, // Track who originally created this lead
        status: 'new',
        isActive: true
      });

      // Create initial history entry
      await storage.createLeadHistory({
        leadId: newLead.id,
        fromUserId: null,
        toUserId: userId,
        previousStatus: null,
        newStatus: 'new',
        changeReason: 'Lead created',
        changeData: JSON.stringify({
          action: 'created',
          createdBy: userId,
          createdAt: new Date().toISOString()
        }),
        changedByUserId: userId
      });

      // Broadcast lead creation to relevant users
      if (typeof (global as any).broadcastUpdate === 'function' && currentUser) {
        (global as any).broadcastUpdate('lead_created', {
          id: newLead.id,
          name: newLead.name,
          email: newLead.email,
          currentOwner: currentUser.fullName,
          createdBy: userId
        }, {
          roles: ['manager', 'admin', 'hr'] // Broadcast to managers, admins, and HR
        });
      }

      res.status(201).json(newLead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  // Bulk upload routes
  app.post('/api/upload-leads', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Handle hardcoded manager
      let userRole = 'hr';
      if (userId === 'hardcoded-manager-id') {
        userRole = 'manager';
      } else {
        const currentUser = await storage.getUser(userId);
        userRole = currentUser?.role || 'hr';
      }
      
      if (userRole !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Note: All imported leads go to Lead Management (unassigned) for HR to pick up

      // Parse Excel file
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);

      // Create upload record
      const upload = await storage.createUpload({
        uploaderId: userId,
        fileName: req.file.originalname,
        rowCount: data.length,
        processedCount: 0,
        failedCount: 0,
        status: 'processing'
      });

      // Validate and process leads
      let processedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      const errors: any[] = [];

      for (const row of data) {
        try {
          const rowData = row as any;
          
          // Check if email already exists in the database
          if (rowData.email) {
            const emailExists = await storage.checkEmailExists(rowData.email);
            if (emailExists) {
              skippedCount++;
              errors.push({ 
                row: processedCount + failedCount + skippedCount, 
                error: `Email ${rowData.email} already exists in database - skipped duplicate`,
                type: 'duplicate_email'
              });
              continue; // Skip this row
            }
          }
          
          // Helper function to handle sessionDays conversion
          const parseSessionDays = (value: any) => {
            if (value === null || value === undefined || value === '') {
              return null; // Schema now accepts null values
            }
            
            // If it's already a valid string enum, return it
            const validEnums = ["M,W,F", "T,T,S", "daily", "weekend", "custom"];
            if (typeof value === 'string' && validEnums.includes(value)) {
              return value;
            }
            
            // Handle common integer mappings to string enums
            const numValue = parseInt(String(value));
            if (!isNaN(numValue)) {
              switch (numValue) {
                case 1: return "M,W,F";
                case 2: return "T,T,S"; 
                case 3: return "daily";
                case 4: return "weekend";
                case 5: return "custom";
                default: return null; // Invalid number, use null
              }
            }
            
            // If it's a string but not a valid enum, return null
            return null;
          };

          // Helper function to get value from rowData with flexible column name matching
          const getColumnValue = (rowData: any, ...possibleNames: string[]) => {
            // Try exact match first
            for (const name of possibleNames) {
              if (name in rowData && rowData[name] != null && rowData[name] !== '') {
                return rowData[name];
              }
            }
            
            // Try case-insensitive match with space/underscore flexibility
            const keys = Object.keys(rowData);
            const normalizedPossibleNames = possibleNames.map(n => 
              n.toLowerCase().replace(/[_\s]/g, '')
            );
            
            for (const key of keys) {
              const normalizedKey = key.toLowerCase().replace(/[_\s]/g, '');
              if (normalizedPossibleNames.includes(normalizedKey)) {
                if (rowData[key] != null && rowData[key] !== '') {
                  return rowData[key];
                }
              }
            }
            
            return null;
          };

          const leadData: any = {
            name: rowData.name,
            email: rowData.email,
            phone: rowData.phone != null ? String(rowData.phone) : null, // Convert to string to handle Excel numbers
            location: rowData.location,
            degree: rowData.degree,
            domain: rowData.domain,
            sessionDays: parseSessionDays(rowData.session_days),
            sourceManagerId: userId,
            status: 'new',
            isActive: true
          };

          // Handle dynamic columns - flexible column name matching
          const yearOfPassing = getColumnValue(rowData, 'year_of_passing', 'yearOfPassing', 'Year of Passing', 'YearOfPassing');
          if (yearOfPassing) {
            leadData.yearOfPassing = String(yearOfPassing);
          }
          
          const collegeName = getColumnValue(rowData, 'college_name', 'collegeName', 'College Name', 'CollegeName');
          if (collegeName) {
            leadData.collegeName = String(collegeName);
          }

          // Always leave imported leads unassigned so they appear in Lead Management
          // HR users can pick them up from there instead of having them auto-assigned
          leadData.currentOwnerId = null;

          const validatedLead = insertLeadSchema.parse(leadData);
          await storage.createLead(validatedLead);
          processedCount++;
        } catch (error) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({ row: processedCount + failedCount + skippedCount, error: errorMessage, type: 'validation_error' });
        }
      }

      // Update upload record with total failed count (validation errors + skipped duplicates)
      await storage.updateUpload(upload.id, {
        processedCount,
        failedCount: failedCount + skippedCount, // Include skipped duplicates in failed count
        status: 'completed',
        errors: JSON.stringify(errors)
      });

      // Broadcast bulk upload completion to HR and managers
      if (typeof (global as any).broadcastUpdate === 'function') {
        (global as any).broadcastUpdate('bulk_upload_completed', {
          count: processedCount,
          failed: failedCount,
          skipped: skippedCount,
          uploadedBy: userId,
          fileName: req.file.originalname
        }, {
          roles: ['hr', 'manager', 'admin'] // Only relevant roles for bulk uploads
        });
      }

      res.json({
        uploadId: upload.id,
        totalRows: data.length,
        processedCount,
        failedCount,
        skippedCount,
        errors
      });
    } catch (error) {
      console.error("Error processing upload:", error);
      res.status(500).json({ message: "Failed to process upload" });
    }
  });

  // Analytics routes
  app.get('/api/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const metrics = await storage.getLeadMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Export routes
  app.get('/api/export', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Handle hardcoded manager
      let userRole = 'hr';
      if (userId === 'hardcoded-manager-id') {
        userRole = 'manager';
      } else {
        const currentUser = await storage.getUser(userId);
        userRole = currentUser?.role || 'hr';
      }
      
      if (userRole !== 'admin' && userRole !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { status, hrId, accountsId, fromDate, toDate, format = 'csv' } = req.query;
      
      const filters: any = {};
      if (status) filters.status = status;
      if (hrId) filters.ownerId = hrId;
      if (accountsId) filters.accountsId = accountsId;
      if (fromDate) filters.fromDate = fromDate;
      if (toDate) filters.toDate = toDate;
      
      const leadsWithUsers = await storage.getLeadsWithUserInfo(filters);
      
      // Create comprehensive export data
      const exportData = leadsWithUsers.map(lead => ({
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        location: lead.location || '',
        degree: lead.degree || '',
        domain: lead.domain || '',
        walkinDate: lead.walkinDate || '',
        walkinTime: lead.walkinTime || '',
        sessionDays: lead.sessionDays || '',
        status: lead.status || '',
        hrName: lead.hrName || 'Unassigned',
        accountsHandlerName: lead.accountsHandlerName || 'N/A',
        managerName: lead.managerName || 'N/A',
        createdAt: lead.createdAt || '',
        updatedAt: lead.updatedAt || ''
      }));

      if (format === 'xlsx') {
        // Excel export
        const ws = xlsx.utils.json_to_sheet(exportData);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Leads');
        
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=leads_export_${new Date().toISOString().split('T')[0]}.xlsx`);
        res.send(buffer);
      } else {
        // CSV export
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=leads_export_${new Date().toISOString().split('T')[0]}.csv`);
        
        // Proper CSV generation with comprehensive escaping
        const escapeCSVValue = (value: any): string => {
          if (value === null || value === undefined) return '';
          const str = String(value);
          // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        
        const headers = Object.keys(exportData[0] || {}).map(escapeCSVValue).join(',');
        const rows = exportData.map(row => 
          Object.values(row).map(escapeCSVValue).join(',')
        );
        const csv = [headers, ...rows].join('\n');
        
        res.send(csv);
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.markNotificationRead(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time features
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    verifyClient: (info: any) => {
      // Basic verification - could be enhanced with session validation
      const origin = info.origin;
      return origin && (origin.includes('replit.dev') || origin.includes('localhost'));
    }
  });
  
  // Store authenticated connections with user info
  const authenticatedClients = new Map();
  
  wss.on('connection', async (ws, request) => {
    let userId = null;
    let userRole = null;
    let userInfo = null;
    
    try {
      // Extract and validate session
      const cookies = request.headers.cookie;
      if (cookies) {
        const sessionMatch = cookies.match(/connect\.sid=s%3A([^.]+)\.[^;]+/);
        if (sessionMatch) {
          const sessionId = decodeURIComponent(sessionMatch[1]);
          
          // Get session store to lookup session data
          const pgStore = connectPg(session);
          const sessionStore = new pgStore({
            conString: process.env.DATABASE_URL,
            createTableIfMissing: false,
            tableName: "sessions",
          });
          
          // Get session data (promisified)
          const sessionData: any = await new Promise((resolve, reject) => {
            sessionStore.get(sessionId, (err: any, session: any) => {
              if (err) reject(err);
              else resolve(session);
            });
          });
          
          if (sessionData && sessionData.passport && sessionData.passport.user) {
            // Extract user info from session
            const sessionUser = sessionData.passport.user;
            if (sessionUser.claims) {
              userId = sessionUser.claims.sub;
              userRole = sessionUser.claims.role || 'hr';
              
              // Get full user info from database
              userInfo = await storage.getUser(userId);
              if (userInfo) {
                console.log(`WebSocket client connected: ${userInfo.email} (${userInfo.role})`);
              }
            }
          }
        }
      }
      
      if (!userId) {
        console.log('WebSocket client connected without valid session, closing...');
        ws.close(4001, 'Unauthorized');
        return;
      }
      
    } catch (error) {
      console.error('WebSocket session validation error:', error);
      ws.close(4001, 'Unauthorized');
      return;
    }
    
    // Store authenticated connection
    authenticatedClients.set(ws, { 
      userId, 
      userRole: userInfo?.role || userRole,
      userEmail: userInfo?.email,
      connected: Date.now() 
    });
    
    ws.on('message', (message) => {
      console.log(`Received from ${userInfo?.email}:`, message.toString());
    });
    
    ws.on('close', () => {
      authenticatedClients.delete(ws);
      console.log(`WebSocket client disconnected: ${userInfo?.email}`);
    });
  });

  // Broadcast function for real-time updates with role-based filtering
  (global as any).broadcastUpdate = (type: string, data: any, options: { 
    userIds?: string[], 
    roles?: string[],
    excludeRoles?: string[]
  } = {}) => {
    authenticatedClients.forEach((clientInfo, client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      
      // Skip unauthenticated clients
      if (!clientInfo.userId && !clientInfo.userRole) {
        console.log('Skipping broadcast to unauthenticated client');
        return;
      }
      
      // Role-based filtering
      if (options.roles && options.roles.length > 0) {
        if (!options.roles.includes(clientInfo.userRole)) return;
      }
      
      if (options.excludeRoles && options.excludeRoles.length > 0) {
        if (options.excludeRoles.includes(clientInfo.userRole)) return;
      }
      
      // User-specific filtering
      if (options.userIds && options.userIds.length > 0) {
        if (!options.userIds.includes(clientInfo.userId)) return;
      }
      
      try {
        client.send(JSON.stringify({ type, data }));
        console.log(`Broadcast sent to user ${clientInfo.userId} (${clientInfo.userRole}): ${type}`);
      } catch (error) {
        console.error('Error sending broadcast:', error);
      }
    });
  };

  return httpServer;
}

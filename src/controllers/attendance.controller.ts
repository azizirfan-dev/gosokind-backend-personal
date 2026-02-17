import { Request, Response } from "express";
import { z } from "zod";
import * as attendanceService from "../services/attendance.service";
import { EmployeeRole } from "../generated/prisma/client";

const attendanceSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});


export const clockIn = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
       res.status(401).json({ success: false, message: "Unauthorized" });
       return;
    }

    const { latitude, longitude } = attendanceSchema.parse(req.body);

    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ success: false, message: "Latitude and Longitude are required." });
      return;
    }

    const result = await attendanceService.clockIn(userId, latitude, longitude);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.message === "ALREADY_CLOCKED_IN") {
      res.status(400).json({ success: false, message: "User is already clocked in." });
      return;
    }
    if (error.message === "OUT_OF_RANGE") {
      res.status(400).json({ success: false, message: "You are too far from the outlet." });
      return;
    }
    if (error.message === "MULTIPLE_SHIFTS_NOT_ALLOWED") {
        res.status(400).json({ success: false, message: "Multiple shifts are not allowed." });
        return; 
    }
    if (error.message === "NO_OUTLET_ASSIGNED") {
      res.status(400).json({ success: false, message: "No outlet assigned to this specific employee account." });
      return;
    }
    handleError(error, res);
  }
};

export const clockOut = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
       res.status(401).json({ success: false, message: "Unauthorized" });
       return;
    }
    
    const result = await attendanceService.clockOut(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message === "NOT_CLOCKED_IN") {
        res.status(400).json({ success: false, message: "User is not clocked in." });
        return;
    }
    handleError(error, res);
  }
};


export const getAttendanceStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const status = await attendanceService.getAttendanceStatus(userId);
    res.json({ success: true, data: status });
  } catch (error) {
    handleError(error, res);
  }
};

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const { userId, role } = (req as any).user;
    const queryId = req.query.employeeId as string;
    const date = req.query.date as string | undefined;

    // RBAC: Only SUPER_ADMIN/OUTLET_ADMIN can request other employee's data
    // Regular employees are locked to their own userId
    let targetId = userId;
    
    if (role === EmployeeRole.SUPER_ADMIN || role === EmployeeRole.OUTLET_ADMIN) {
        targetId = queryId || userId;
    }

    const data = await attendanceService.getDashboardData(targetId, date);
    res.json({ success: true, data });
  } catch (error: any) {
    handleError(error, res);
  }
};

export const getAllAttendance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { page, limit } = parsePagination(req.query);
    const date = req.query.date as string | undefined;

    if (!user.outletId) {
       res.status(400).json({ success: false, message: "User has no outlet assigned" });
       return;
    }

    const result = await attendanceService.getAllAttendance(user.outletId, page, limit, date);
    res.json({ success: true, ...result });
  } catch (error: any) {
    handleError(error, res);
  }
};

// --- HELPERS ---

const parsePagination = (query: any) => {
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  return { page, limit };
};

function handleError(error: any, res: Response) {
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, message: "Validation Error", errors: error.issues });
    return;
  }
  console.error(error);
  res.status(500).json({ success: false, message: "Internal Server Error" });
}

import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

export const ensureClockedIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Check for active shift (clockIn today, no clockOut)
    // Actually, simple check: is there a record with clockOut: null?
    // We already have this logic in service, but let's do a quick check here or call service?
    // Direct DB call is faster/simpler for middleware.
    
    const activeShift = await prisma.attendance.findFirst({
        where: {
            employeeId: userId,
            clockOut: null
        }
    });

    if (!activeShift) {
      return res.status(403).json({ 
          success: false, 
          message: "CLOCK_IN_REQUIRED",
          details: "You must clock in to access this resource."
      });
    }

    // Attach shift info to request if needed?
    (req as any).activeShift = activeShift;

    next();
  } catch (error) {
    console.error("Middleware ensureClockedIn Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

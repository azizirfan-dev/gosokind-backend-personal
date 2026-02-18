import { Request, Response } from "express";
import { z } from "zod";
import * as service from "../services/driver.service";

// Schema Validation untuk Body
const orderIdSchema = z.object({
  orderId: z.string().cuid({ message: "Invalid Order ID Format" }),
});

// --- HTTP HANDLERS (Jembatan req/res ke Service) ---

export const checkAvailability = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const result = await service.checkAvailability(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
};

export const getHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const result = await service.getDriverHistory(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
};

export const getActiveJob = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const result = await service.getDriverActiveJob(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
};

export const getAvailableJobs = async (req: Request, res: Response) => {
  try {
    const result = await service.getAvailableJobs();
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
};

export const acceptPickup = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    // Validasi input dari req.body
    const { orderId } = orderIdSchema.parse(req.body);
    
    // Panggil Service (Business Logic)
    await service.acceptPickup(userId, orderId);
    
    res.json({ success: true, message: "Pickup accepted successfully" });
  } catch (error) {
    handleError(res, error);
  }
};

export const completePickup = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { orderId } = orderIdSchema.parse(req.body);

    await service.completePickup(userId, orderId);

    res.json({ success: true, message: "Pickup completed. Laundry at outlet." });
  } catch (error) {
    handleError(res, error);
  }
};

export const acceptDelivery = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { orderId } = orderIdSchema.parse(req.body);

    await service.acceptDelivery(userId, orderId);

    res.json({ success: true, message: "Delivery accepted successfully" });
  } catch (error) {
    handleError(res, error);
  }
};

export const completeDelivery = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { orderId } = orderIdSchema.parse(req.body);

    await service.completeDelivery(userId, orderId);

    res.json({ success: true, message: "Delivery completed successfully" });
  } catch (error) {
    handleError(res, error);
  }
};

// --- CENTRALIZED ERROR HANDLER ---
function handleError(res: Response, error: any) {
  // 1. Validation Error (Zod)
  if (error instanceof z.ZodError) {
    return res.status(400).json({ 
      success: false, 
      message: "Validation Error", 
      errors: error.issues 
    });
  }

  // 2. Known Business Errors
  const statusMap: Record<string, number> = {
    "DRIVER_BUSY": 400,
    "ORDER_UNAVAILABLE": 409, // Conflict (Rebutan order)
    "ORDER_NOT_FOUND_OR_INVALID": 404,
    "OUT_OF_RANGE": 400
  };

  const status = statusMap[error.message] || 500;
  const message = status === 500 ? "Internal Server Error" : error.message;

  if (status === 500) console.error(error); // Log error server fatal

  res.status(status).json({ success: false, message });
}
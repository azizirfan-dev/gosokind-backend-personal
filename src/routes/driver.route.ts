import { Router } from "express";
import * as driverController from "../controllers/driver.controller";
import { verifyToken } from "../middlewares/auth.middleware"; // WAJIB ADA!

const router = Router();

// Semua route driver HARUS terproteksi
router.use(verifyToken); 

// Frontend Data Aggregators
router.get("/active", driverController.getActiveJob);
router.get("/available", driverController.getAvailableJobs);

router.get("/availability", driverController.checkAvailability);
router.get("/history", driverController.getHistory);

// Pickup Flow
router.post("/pickup/accept", driverController.acceptPickup);
router.post("/pickup/complete", driverController.completePickup);

// Delivery Flow
router.post("/delivery/accept", driverController.acceptDelivery);
router.post("/delivery/complete", driverController.completeDelivery);

export default router;
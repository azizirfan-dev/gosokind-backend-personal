import { Router } from "express";
import * as workerController from "../controllers/worker.controller";
import { verifyToken } from "../middlewares/auth.middleware"; // WAJIB
import { ensureClockedIn } from "../middlewares/ensureClockedIn";

const router = Router();

router.use(verifyToken); // Kunci semua endpoint worker
router.use(ensureClockedIn); // WAJIB Clock In sebelum kerja

router.get("/orders", workerController.getOrderList); // Incoming Jobs
router.get("/history", workerController.getJobHistory); // Completed Jobs
router.post("/process", workerController.processOrder); // Execute Job

export default router;
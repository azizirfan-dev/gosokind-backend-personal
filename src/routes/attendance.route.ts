import { Router } from "express";
import * as attendanceController from "../controllers/attendance.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(verifyToken);

router.post("/clock-in", attendanceController.clockIn);
router.post("/clock-out", attendanceController.clockOut);
router.get("/status", attendanceController.getAttendanceStatus);
router.get("/dashboard", attendanceController.getDashboard);
router.get("/", attendanceController.getAllAttendance);

export default router;

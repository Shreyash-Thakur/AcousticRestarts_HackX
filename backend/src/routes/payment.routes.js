import { Router } from "express";
import {
  createOrder,
  createLink,
  verifyPayment,
} from "../controllers/payment.controller.js";

const router = Router();

router.post("/payments/create-order", createOrder);
router.post("/payments/create-link", createLink);
router.post("/payments/verify", verifyPayment);

export default router;

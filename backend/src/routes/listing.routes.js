import { Router } from "express";
import {
  createListing,
  getListings,
  buyListing,
  cancelListing,
} from "../controllers/listing.controller.js";

const router = Router();

router.post("/listings", createListing);
router.get("/listings", getListings);
router.post("/listings/:id/buy", buyListing);
router.delete("/listings/:id", cancelListing);

export default router;

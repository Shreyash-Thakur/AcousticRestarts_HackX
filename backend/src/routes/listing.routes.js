import { Router } from "express";
import {
  getListingConfig,
  createListing,
  getListings,
  buyListing,
  cancelListing,
} from "../controllers/listing.controller.js";

const router = Router();

router.get("/listings/config", getListingConfig);
router.post("/listings", createListing);
router.get("/listings", getListings);
router.post("/listings/:id/buy", buyListing);
router.delete("/listings/:id", cancelListing);

export default router;

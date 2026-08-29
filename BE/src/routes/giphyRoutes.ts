import { Router } from "express";
import { searchGiphy } from "../controllers/giphy/giphyController";

const router = Router();

router.get("/search", searchGiphy);

export default router;

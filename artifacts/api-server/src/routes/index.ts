import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tasksRouter from "./tasks";
import checkinRouter from "./checkin";
import patternsRouter from "./patterns";
import audioRouter from "./audio";
import agentRouter from "./agent";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tasksRouter);
router.use(checkinRouter);
router.use(patternsRouter);
router.use(audioRouter);
router.use(agentRouter);

export default router;

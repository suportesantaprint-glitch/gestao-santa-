import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import chamadasRouter from "./chamadas";
import pecasRouter from "./pecas";
import pedidosRouter from "./pedidos";
import contratosRouter from "./contratos";
import filtrosRouter from "./filtros";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(chamadasRouter);
router.use(pecasRouter);
router.use(pedidosRouter);
router.use(contratosRouter);
router.use(filtrosRouter);

export default router;

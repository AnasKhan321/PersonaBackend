import { updateAllProfile } from "./index.js";
import cron from "node-cron"

export const startUpdating = ()=>{
    cron.schedule('0 4 */3 * *', updateAllProfile, { timezone: 'UTC' });

}
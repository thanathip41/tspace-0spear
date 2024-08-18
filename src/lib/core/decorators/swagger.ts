import { TSwagger } from "../types";

export const Swagger = (data : TSwagger) => {
    return (target: any, propertyKey: any) => {
        const controller = target.constructor;
        
        const swaggers: any[] = Reflect.hasMetadata("swaggers", controller) 
        ? Reflect.getMetadata("swaggers", controller) 
        : [];
  
        swaggers.push({
            handler :propertyKey,
            ...data
        });
  
        Reflect.defineMetadata("swaggers", swaggers, controller);
      }
  }
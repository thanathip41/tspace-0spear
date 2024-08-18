import { TRouter , TMethods } from '../types'

const methodDecorator = (method: TMethods) => {
  return (path: `/${string}`): MethodDecorator => {
    return (target, propertyKey) => {
      const controller = target.constructor;

      const routers: TRouter[] = Reflect.hasMetadata("routers", controller) 
        ? Reflect.getMetadata("routers", controller) 
        : [];

      routers.push({
        method,
        path,
        handler: propertyKey,
      });

      Reflect.defineMetadata("routers", routers, controller);
    }
  }
}

export const Get = methodDecorator('get');
export const Post = methodDecorator('post');
export const Put = methodDecorator('put');
export const Patch = methodDecorator('patch');
export const Delete = methodDecorator('delete');
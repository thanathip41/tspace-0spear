import { TContext , TNextFunction , TRequestFunction } from '../types';

export const Middleware = (middleware : TRequestFunction) => {
  
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = function(ctx : TContext , next : TNextFunction) {
      try {

        Reflect.defineMetadata("middlewares", descriptor , target)

        return middleware(ctx, (err ?: any) => {
          if(err != null) {
            return next(err)
          }
          return originalMethod.call(this, ctx , next);
        })

      } catch (error : any) {

        return next(error)
      }
    };
  };
}
  
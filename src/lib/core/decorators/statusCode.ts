import { TContext, TNextFunction } from '../types';

export const  StatusCode = (statusCode : number) => {
    return (target: any, key: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        statusCode = statusCode < 100 ? 100 : statusCode > 599 ? 599 : statusCode;

        descriptor.value = async function(ctx : TContext , next :TNextFunction) {
            ctx.res.writeHead(statusCode , { 'Content-Type': 'application/json'})
            return await originalMethod.call(this, ctx , next);
        };

        return descriptor;
    };
}

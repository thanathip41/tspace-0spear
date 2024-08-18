import { TContext, TNextFunction } from '../types';

export const Body = (...bodyParms : string[]) => {
    return function(target: any, key: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function(ctx : TContext , next :TNextFunction) {
            const q = ctx?.body ?? {}
            const body = bodyParms.reduce((acc, key) => (q[key] != null ? { ...acc, [key]: q[key] } : acc), {})
            ctx.body = Object.keys(body).length ? body : {}

            return await originalMethod.call(this, ctx , next);
        };

        return descriptor;
    };
}

export const Files = (...filesParms : string[]) => {
    return function(target: any, key: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function(ctx : TContext , next :TNextFunction) {
            const q = ctx?.files ?? {}
            const files = filesParms.reduce((acc, key) => (q[key] != null ? { ...acc, [key]: q[key] } : acc), {})
            ctx.files = Object.keys(files).length ? files : {}

            return await originalMethod.call(this, ctx , next);
        };

        return descriptor;
    };
}

export const Params = (...paramsData : string[]) => {
    return function(target: any, key: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function(ctx : TContext , next :TNextFunction) {
            const q = ctx?.params ?? {}
            const params = paramsData.reduce((acc, key) => (q[key] != null ? { ...acc, [key]: q[key] } : acc), {})
            ctx.params = Object.keys(params).length ? params : {}

            return await originalMethod.call(this, ctx , next);
        };

        return descriptor;
    };
}

export const Query = (...queryParms : string[]) => {
    return function(target: any, key: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function(ctx : TContext , next :TNextFunction) {
            const q = ctx?.query ?? {}
            const query = queryParms.reduce((acc, key) => (q[key] != null ? { ...acc, [key]: q[key] } : acc), {})
            ctx.query = Object.keys(query).length ? query : {}

            return await originalMethod.call(this, ctx , next);
        };

        return descriptor;
    };
}


export const Cookies = (...cookiesParms : string[]) => {
    return function(target: any, key: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function(ctx : TContext , next :TNextFunction) {
            const q = ctx?.cookies ?? {}
            const cookies = cookiesParms.reduce((acc, key) => (q[key] != null ? { ...acc, [key]: q[key] } : acc), {})
            ctx.cookies = Object.keys(cookies).length ? cookies : {}

            return await originalMethod.call(this, ctx , next);
        };

        return descriptor;
    };
}
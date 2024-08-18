import { IncomingMessage, ServerResponse } from "http";

export type TContext= {
    req : TRequest
    res : TResponse
    headers : THeaders 
    query : TQuery
    params : TParams
    body  : TBody
    files : TFiles
    cookies : TCookies
}

export type THeaders<T = Record<string, string>> = T

export type TQuery<T = Record<string, string>> = T

export type TParams<T = Record<string, string>> = T

export type TBody<T = Record<string, 
    string | number | boolean | undefined | null | any[] | 
    Record<string, string | number | boolean | undefined | null | any[]> 
>> = T

export type TCookies<T = Record<string, any>> = T

export type TFiles<T = Record<string, {
    name: string;
    tempFilePath: string;
    tempName: string;
    mimetype: string;
    extension : string;
    size: number;
    sizes : {
        bytes : number,
        kb    : number,
        mb    : number,
        gb    : number
    };
    remove : () => void
}[]>> = T

export type TNextFunction<T = any> = (err ?: Error) =>  T | Promise<T> 

export type TRequest<T = any> = IncomingMessage & Partial<T>

type THttpStatus = {
    json : (data?: Record<string,any>) => void;
    error: (err: any) => void;
    ok: (data ?: Record<string,any>) => void;
    created: (data ?: Record<string,any>) => void; 
    accepted: (data ?: Record<string,any>) => void;
    noContent: (message?: string) => void;
    badRequest: (message?: string) => void;
    unauthorized: (message?: string) => void;
    paymentRequired: (message?: string) => void;
    forbidden: (message?: string) => void;
    notFound: (message?: string) => void;
    serverError: (message: string) => void;
    forceStatus: (code : number) => void;
    setCookies : (cookies : Record<string,string | { 
        value      : string
        sameSite   ?: 'Strict' | 'Lax' | 'None'
        domain     ?: string
        secure     ?: boolean
        httpOnly   ?: boolean
        expires    ?: Date
    }>) => void
}


export type TResponse<T = any> = ServerResponse & {
    status : (code : 
        200 | 201 | 202 | 203 | 204 |
        300 | 301 | 302 | 303 | 304 |
        400 | 401 | 402 | 403 | 404 |
        500 | 501 | 502 | 503 | 504
    ) => {
        json : (data?: Record<string,any>) => void;
        send : (message : string) => void;
    }
} & THttpStatus & Partial<T>

export type TRouter = {
    method: TMethods;
    path: string;
    handler: string | symbol;
}

export type IRoute = {
    method : TMethods, 
    path : string , 
    handlers : TContext[]
}

export type TMethods = 'get' | 'post' | 'patch' | 'put' | 'delete' | 'all'

export type TApplication = {
    controllers  ?: (new () => any)[] | { folder : string ,  name ?: RegExp}
    middlewares  ?: TRequestFunction[] | { folder : string , name ?: RegExp}
    globalPrefix  ?: string
    logger       ?: boolean
    cluster      ?: boolean | number 
}

export type TRequestFunction = (ctx : TContext , next : TNextFunction) => any
  
export type TErrorFunction = (err : Error, ctx : TContext) => any


type TSwaggerFormat = "string" | "number" | "integer" | "boolean" | "object" | "array" | "date" | "date-time" | "password" | "int32" | "int64" | "float" | "double" | "byte" | "binary" | "base64" | "email" | "uuid" | "uri" | "hostname" | "ipv4" | "ipv6" | "json" | "xml";

type TSwaggerType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "date" | "date-time" | "file"

export type TSwaggerDoc = {
    path ?: `/${string}`
    staticUrl ?: `${string}`
    servers ?: { url : string , description ?: string }[]
    tags ?: string[]
    info ?: {
        title ?: string,
        description ?: string,
        version ?: string
    },
    routes : {path : string , method : string , params : string[]}[]
    options : (TSwagger & { path : string , method : string})[]
    responses ?: {
        status : number,
        description : string,
        example ?: Record<string,any>
    }[]
}

export type TSwagger = {
    staticUrl ?: string
    description ?: string
    bearerToken ?: boolean
    tags        ?: string[]
    query ?: Record<string , {
        required ?: boolean,
        description ?: string,
        type : TSwaggerType
        example ?: any
    }>
    cookies ?: {
        names : string[],
        required ?: boolean,
        description ?: string
    },
    body  ?: {
        required ?: boolean,
        description ?: string,
        properties : Record<string , {
            type : TSwaggerType
            example ?: any
        }>
    }
    files  ?: {
        required ?: boolean,
        description ?: string,
        properties : Record<string , {
            type : TSwaggerType
            format ?: TSwaggerFormat,
            items ?: any,
            example ?: any
        }>
    }
    responses ?: {
        status : number,
        description : string,
        example ?: Record<string,any>
    }[]
}
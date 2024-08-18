import cluster      from 'cluster'
import os           from 'os'
import fs           from 'fs'
import path         from 'path'
import qs           from 'querystring'
import onFinished   from "on-finished"
import { 
    IncomingMessage, 
    Server, 
    ServerResponse 
} from 'http'
import findMyWayRouter, { 
    Instance 
} from 'find-my-way'
import uWS , { HttpResponse , HttpRequest} from 'uWebSockets.js'
import { ParserFactory } from './parser-factory'
import { Router } from './router'
import type { 
    TContext , 
    TNextFunction, 
    TResponse , 
    TRouter, 
    TApplication,
    TRequestFunction,
    TErrorFunction,
    TRequest,
    TBody,
    TFiles,
    TQuery,
    TCookies,
    THeaders,
    TSwagger,
    TParams
} from '../types'

/**
 * 
 * The 'Spear' class is used to create a server and handle HTTP requests.
 * 
 * @returns {Spear} application
 * @example
 * new Spear()
 *  .get('/' , () => 'Hello world!')
 *  .get('/json' , () => {
 *     return {
 *       message : 'Hello world!'
 *     }
 *   })
 *  .listen(3000 , () => console.log('server listening on port : 3000'))
 *   
 */
class Spear {

    private readonly _controllers ?: (new () => any)[] | { folder : string ,  name ?: RegExp}
    private readonly _middlewares ?: TRequestFunction[] | { folder : string , name ?: RegExp}
    private readonly _globalPrefix : string
    private readonly _cluster ?: number | boolean
    private readonly _router : Instance<findMyWayRouter.HTTPVersion.V1> = findMyWayRouter()
    private readonly _parser = new ParserFactory()
    private _onFinished : Function | null =  null
    private _swagger : {
        use : boolean
        path ?: `/${string}`
        servers ?: { url : string }[]
        tags ?: string[]
        info ?: {
            title ?: string,
            description ?: string,
            version ?: string
        }
    } = {
        use : false,
        path : '/api/docs',
        servers : [
            {
                url : 'http://localhost:3000'
            }
        ],
        tags : [],
        info : {
            title : "API Documentation",
            description : "This is a sample documentation",
            version : "1.0.0"
        }
    }
    
    private _swaggerAdditional : (TSwagger & { path : string , method : string })[] = []
    private _errorHandler : TErrorFunction | null = null
    private _globalMiddlewares : TRequestFunction[] = []
    private _formatResponse : Function | null = null
    private _onListeners : Function[] = []
    private _fileUploadOptions : { 
        limit : number  
        tempFileDir : string 
        removeTempFile : { remove : boolean; ms : number }
    } = {
        limit : Infinity,
        tempFileDir : 'tmp',
        removeTempFile : {
            remove : false,
            ms : 1000 * 60 * 10
        }
    }
    
    constructor({
        controllers,
        middlewares,
        globalPrefix,
        logger,
        cluster
    } : TApplication = {}) {
        if(logger) this.useLogger()
        this._cluster       = cluster;
        this._controllers   = controllers;
        this._middlewares   = middlewares;
        this._globalPrefix  = globalPrefix == null ? '' : globalPrefix;
    }

    /**
     * The get 'instance' method is used to get the instance of Spear.
     * 
     * @returns {this}
     */
    get instance (): this {
        
        return this
    }
    
    /**
     * The get 'routers' method is used get the all routers.
     * 
     * @returns {Instance<findMyWayRouter.HTTPVersion.V1>}
     */
    get routers (): Instance<findMyWayRouter.HTTPVersion.V1> {

        return this._router;
    }

    /**
     * The 'use' method is used to add the middleware into the request pipeline.
     * 
     * @callback {Function} middleware
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    use (middleware : (ctx : TContext , next : TNextFunction) =>  void): this {

        this._globalMiddlewares.push(middleware)

        return this
    }

    /**
     * The 'useLogger' method is used to add the middleware view logger response.
     * 
     * @callback {Function} middleware
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    useLogger ({ methods , exceptPath } : { methods ?: ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[] , exceptPath ?: string[] | RegExp } = {}): this  {
        
        this._globalMiddlewares.push(({ req , res } : TContext , next : TNextFunction) => {
           
            const diffTime = (hrtime?: [number, number]) => {
                const MS = 1000
    
                if (hrtime == null) return 0
    
                const [start, end] = process.hrtime(hrtime)
    
                const time = ((start * MS ) + (end / 1e6))
                
                return `${time > MS ? `${(time / MS).toFixed(2)} s` : `${time.toFixed(2)} ms`}`
            }
          
            const statusCode = (res: TResponse) => {
              const statusCode = res.statusCode == null ? 500 : Number(res.statusCode);
              return statusCode < 400
                ? `\x1b[32m${statusCode}\x1b[0m`
                : `\x1b[31m${statusCode}\x1b[0m`
            }
            
            if(exceptPath instanceof RegExp && exceptPath.test(String(req.url))) return next()
        
            if(Array.isArray(exceptPath) && exceptPath.some(v => String(req.url) === v)) return next()

            if(
                methods != null && 
                methods.length && 
                !methods.some(v => v.toLocaleLowerCase() === String(req.method).toLocaleLowerCase())
            ) {
                return next()
            }

            const startTime = process.hrtime()
    
            this._onFinished = () => {
                onFinished(res, (): void => {
                    console.log(
                        [
                        `[\x1b[1m\x1b[34mINFO\x1b[0m]`,
                        `\x1b[34m${new Date().toJSON()}\x1b[0m`,
                        `\x1b[33m${req.method}\x1b[0m`,
                        `${decodeURIComponent(String(req.url))}`,
                        `${statusCode(res)}`,
                        `${diffTime(startTime)}`,
                        ].join(" ")
                    );
                });
            }
            
            return next();
        })

        return this
    }

    /**
     * The 'useBodyParser' method is a middleware used to parse the request body of incoming HTTP requests.
     * @param {object?} 
     * @property {array?} except the body parser with some methods
     * @returns {this}
     */
    useBodyParser ({ except } : { except ?: ('GET' | 'POST' |'PUT' |'PATCH' | 'DELETE')[] } = {}): this {

        this._globalMiddlewares.push(async({ req , res } : TContext , next : TNextFunction) => {

            const contentType = req?.headers['content-type'];

            const isFileUpload = contentType && contentType.startsWith('multipart/form-data');

            if(except != null && Array.isArray(except)) {
                if(except.some(v => v.toLocaleLowerCase() === (req.method)?.toLocaleLowerCase())) {
                    return next()
                }
            }
            
            if(isFileUpload) return next()

            if(req?.body != null) return next()

            Promise.resolve(this._parser.body(res))
            .then(r => {
                req.body = r 
                return next()
            })
            .catch(err => {
                return next()
            })
        })

        return this
    }

    /**
     * The 'useFileUpload' method is a middleware used to handler file uploads. It adds a file upload of incoming HTTP requests.
     * 
     * @param {?Object} 
     * @property {?number} limits
     * @property {?string} tempFileDir
     * @property {?Object} removeTempFile
     * @property {boolean} removeTempFile.remove
     * @property {number} removeTempFile.ms
     * @returns 
     */
    useFileUpload ({ limit, tempFileDir , removeTempFile } : {
        limit ?: number
        tempFileDir ?: string
        removeTempFile ?: {
            remove : boolean
            ms : number
        }
    } = {}) {

        if(limit != null) {
            this._fileUploadOptions.limit = limit
        }

        if(tempFileDir != null) {
            this._fileUploadOptions.tempFileDir = tempFileDir
        }

        if(removeTempFile != null) {
            this._fileUploadOptions.removeTempFile = removeTempFile
        }
 
        this._globalMiddlewares.push(({ req , res } : TContext , next : TNextFunction) => {

            const contentType = req?.headers['content-type'];

            const isFileUpload = contentType && contentType.startsWith('multipart/form-data');

            if(req.method === 'GET') {
                return next()
            }

            if(!isFileUpload) return next()

            if(req?.files != null) return next()

            Promise.resolve(this._parser.files({ req , res, options : this._fileUploadOptions}))
            .then(r => {
                req.files = r.files
                req.body = r.body
                return next()
            })
            .catch(err => {
                return next()
            })
        })

        return this
    }

    /**
     * The 'useCookiesParser' method is a middleware used to parses cookies attached to the client request object.
     *
     * @returns {this}
     */
    useCookiesParser (): this {

        this._globalMiddlewares.push(({ req } : TContext , next : TNextFunction) => {

            if(req?.cookies != null) return next()

            req.cookies = this._parser.cookies(req)
           
            return next()
        })
        
        return this
    }

    /**
     * The 'useRouter' method is used to add the router in the request context.
     * 
     * @parms {Function} router
     * @property  {Function} router - get() , post() , put() , patch() , delete() 
     * @returns {this}
     */
    useRouter (router : Router): this {

        const routes = router.routes

        for(const { path , method , handlers } of routes) {
            this[method](this._normalizePath(this._globalPrefix , path) , ...handlers)
        }

        return this
    } 

    /**
     * The 'useSwagger' method is a middleware used to create swagger api.
     * 
     * @param {?Object} 
     * @property {?string} path
     * @property {?array} servers
     * @property {?object} info
     * @property {?array} tags
     * @returns 
     */
    useSwagger({
        path,
        servers,
        info,
        tags
    } : {
        path ?: `/${string}`
        servers ?: { url : string , description ?: string }[]
        tags ?: string[]
        info ?: {
            title ?: string,
            description ?: string,
            version ?: string
        }
    } = {}) {

        this._swagger = {
            use : true,
            path : path ?? this._swagger.path,
            servers : servers ?? this._swagger.servers,
            tags : tags ?? this._swagger.tags,
            info : info ?? this._swagger.info
        }

        return this
    }

    /**
     * The 'listen' method is used to bind and start a server to a particular port and optionally a hostname.
     * 
     * @param {number} port 
     * @param {function} callback 
     * @returns 
     */
    async listen(port : number | (() => ServerResponse) = 3000, callback : (callback : { server : Server , port : number }) => void) {

        if(arguments.length === 1 && typeof port === 'function') {
            callback = port
            port = 3000
        }

        const server = await this._createServer()
        
        if(
            this._cluster != null && 
            this._cluster || typeof this._cluster === 'number'
        ) {
            this._clusterMode(server , Number(port) , callback)
            return
        }

        server.listen(port == null ? 3000 : port , () => {
            this._onListeners.forEach(listener => listener())

            if(this._swagger.use) {
                this._swaggerHandler()
            }

            if(callback) callback({ server , port} as { server : Server , port : number })
        })

        return
    }

    /**
     * The 'enableCors' is used to enable the cors origins on the server.
     * 
     * @params {Object} 
     * @property {(string | RegExp)[]} origins
     * @property {boolean} credentials
     * @returns 
     */
    enableCors({ origins , credentials } : {
        origins ?: (string | RegExp)[] , 
        credentials ?: boolean
    } = {}) {

        this._globalMiddlewares.push(({ req , res } : TContext , next : TNextFunction) => {

            const origin = req.headers?.origin

            if(origin == null) return next()

            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

            if(origins == null) {
                res.setHeader('Access-Control-Allow-Origin', '*')
            }

            if(Array.isArray(origins) && origins.length) {
                if(origins.includes(origin)) {
                    res.setHeader('Access-Control-Allow-Origin', origin);
                }
            }

            if(credentials) {
                res.setHeader('Access-Control-Allow-Credentials', 'true');
            }
            
            return next()
        })

        return this
    }

    /**
     * The 'response' method is used to format the response
     * 
     * @param {function} format 
     * @returns 
     */
    response (format : (r : unknown , statusCode : number) => any) {
        this._formatResponse = format
        return this
    }

    /**
     * The 'catch' method is middleware that is specifically designed to handle errors.
     * 
     * that occur during the processing of requests
     * 
     * @param {function} error 
     * @returns 
     */
    catch (error : (err : any , ctx : TContext) =>  any) {
        this._errorHandler = error
        return this
    }

    /**
     * The 'notfound' method is middleware that is specifically designed to handle errors notfound that occur during the processing of requests
     * 
     * @param {function} notfound 
     * @returns 
     */
    notfound (fn : (ctx : TContext) =>  any) {

        const handler = ({ req , res } : TContext) =>{
            
            return fn({ 
                req, 
                res     : this._customizeResponse(req,res),
                headers : {},
                query   : {},
                files   : {},
                body    : {},
                params  : {},
                cookies : {}
            })
        }
    
        this.all('*', ...this._globalMiddlewares, handler)

        return this
    }

    /**
     * The 'get' method is used to add the request handler to the router for the 'GET' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    get (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {

        this._onListeners.push(() => {
            return this._router.get(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })

        return this
    }

    /**
     * The 'post' method is used to add the request handler to the router for the 'POST' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    post (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._onListeners.push(() => {
            return this._router.post(
                this._normalizePath(this._globalPrefix, path),  
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
    }

    /**
     * The 'put' method is used to add the request handler to the router for the 'PUT' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    put (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._onListeners.push(() => {
            return this._router.put(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
    }

    /**
     * The 'patch' method is used to add the request handler to the router for the 'PATCH' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    patch (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._onListeners.push(() => {
            return this._router.patch(
                this._normalizePath(this._globalPrefix, path),  
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
    }

    /**
     * The 'delete' method is used to add the request handler to the router for the 'DELETE' method.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {Object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {Function} next  - go to next function
     * @returns {this}
     */
    delete (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._onListeners.push(() => {
            return this._router.delete(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
    }

    /**
     * The 'all' method is used to add the request handler to the router for 'GET' 'POST' 'PUT' 'PATCH' 'DELETE' methods.
     * 
     * @param {string} path
     * @callback {...Function[]} handlers of the middlewares
     * @property  {object} ctx - context { req , res , query , params , cookies , files , body}
     * @property  {function} next  - go to next function
     * @returns {this}
     */
    all (path : string , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {

        this._onListeners.push(() => {
            return this._router.all(
                this._normalizePath(this._globalPrefix, path), 
                this._wrapHandlers(...this._globalMiddlewares,...handlers)
            );
        })
        return this
    }

    private _clusterMode (server : Server , port : number , callback : (callback : { server : Server , port : number }) => void ) {

        if (cluster.isPrimary) {

            const numCPUs = os.cpus().length

            const maxWorkers = typeof this._cluster === 'boolean' || this._cluster == null
            ? numCPUs
            : this._cluster

            for (let i = 0; i < maxWorkers; i++) {
                cluster.fork()
            }

            cluster.on('exit', () => {
                cluster.fork()
            })
        } 

        if(cluster.isWorker) {
            server.listen(port == null ? 3000 : port , () => {
                this._onListeners.forEach(listener => listener())

                if(this._swagger.use) {
                    this._swaggerHandler()
                }

                if(callback) callback({ server , port} as { server : Server , port : number })
            })
        }

        return
    }

    private async _import (dir: string , pattern ?: RegExp): Promise<string[]> {
        const directories = fs.readdirSync(dir, { withFileTypes: true });
        const files: any[] = (await Promise.all(
          directories.map((directory) => {
            const newDir = path.resolve(String(dir), directory.name);
            if(pattern == null) {
                return directory.isDirectory() ? this._import(newDir) : newDir;
            }
            return directory.isDirectory() 
            ? this._import(newDir) 
            : pattern.test(directory.name) 
              ? newDir
              : null
          })
        )).filter(d => d != null)

        return [].concat(...files);
    }

    private async _registerControllers(): Promise<void> {
        
        if(this._controllers == null) return

        if(!Array.isArray(this._controllers)) {
           
            const controllers = await this._import(this._controllers.folder , this._controllers.name)

            for(const file of controllers) {

                const response = await import(file)

                const controller = response?.default

                const controllerInstance = new controller();
    
                const prefixPath: string = Reflect.getMetadata("controllers", controller) ?? ''

                const routers: TRouter[] = Reflect.getMetadata("routers", controller) ?? []

                const swaggers: any[] = Reflect.getMetadata("swaggers", controller) ?? []

                if(prefixPath == null) continue
    
                for(const { method, path, handler } of Array.from(routers)) {

                    const find = Array.from(swaggers).find(s => s.handler === handler)

                    if(find != null) {
                        this._swaggerAdditional = [
                            ...this._swaggerAdditional , 
                            {
                                ...find,
                                path : this._normalizePath(this._globalPrefix , prefixPath, path),
                                method
                            }
                        ]
                    }
                
                    this[method](
                        this._normalizePath(this._globalPrefix ,prefixPath ,path), 
                        controllerInstance[String(handler)].bind(controllerInstance)
                    )
                }
            }

            return
        }

        for(const controller of this._controllers) {

            const controllerInstance = new controller();

            const prefixPath: string = Reflect.getMetadata("controllers", controller) ?? ''

            const routers: TRouter[] = Reflect.getMetadata("routers", controller) ?? []

            const swaggers: any[] = Reflect.getMetadata("swaggers", controller) ?? []

            if(prefixPath == null) continue

            for(const { method, path, handler} of Array.from(routers)) {

                const find = Array.from(swaggers).find(s => s.handler === handler)

                if(find != null) {
                    this._swaggerAdditional = [
                        ...this._swaggerAdditional , 
                        {
                            ...find,
                            path : this._normalizePath(this._globalPrefix , prefixPath, path),
                            method
                        }
                    ]
                }

                this[method](
                    this._normalizePath(this._globalPrefix , prefixPath, path), 
                    controllerInstance[String(handler)].bind(controllerInstance)
                )
            }
        }
    }

    private async _registerMiddlewares(): Promise<void> {

        if(this._middlewares == null) return

        if(!Array.isArray(this._middlewares)) {
           
            const middlewares = await this._import(this._middlewares.folder , this._middlewares.name)

            for(const file of middlewares) {

                const response = await import(file)

                const middleware = response?.default
                
                this.use(middleware)
    
            }

            return
        }
        
        const middlewares : any[] = this._middlewares

        for(const middleware of middlewares) {
            this.use(middleware);
        }

        return
    }

    private _customizeResponse (req : any, res : any) : TResponse {

        const response = res as unknown as TResponse

        response.json = (results ?: Record<string,any>) => {

            if (!res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
            }

            res.end(results == null ? undefined : JSON.stringify(results, null, 2));
            return
        }

        response.send = (results : string) => {

            res.writeHead(res.statusCode, { 'Content-Type': 'text/plain' })
                
            return res.end(results)
        }

        response.html = (results : string) => {

            res.writeHead(res.statusCode, {'Content-Type': 'text/html'})

            return res.end(results)
        }

        response.error = (err ) => {

            let code =
                +err.status ||
                +err.statusCode ||
                +err.response?.data?.statusCode ||
                +err.response?.data?.code ||
                +err.code ||
                500;

            code = (code == null || typeof code !== 'number') ? 500 : Number.isNaN(code) ? 500 : code < 400 ? 500 : code

            const message =
                err.response?.data?.errorMessage ||
                err.response?.data?.message ||
                err.message ||
                `The url '${req.url}' resulted in a server error. Please investigate.`
                ;
            
            response.status(code as any)

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, code) ,null,2))
            }

            return res.end(JSON.stringify({
                message : message 
            },null,2))
        }

        response.ok = (results ?: Record<string,any> ) => {

            if (!res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
            }

            res.end(results == null ? undefined : JSON.stringify(results, null, 2));

            return
        }

        response.created = (results ?: Record<string,any>) => {
            response.status(201)
            return response.json(results == null ? {} : results)
        }

        response.accepted = (results ?: Record<string,any>) => {
            response.status(202)
            return response.json(results == null ? {} : results)
        }

        response.noContent = () => {

            if (!res.headersSent) {
                response.status(202)
            }

            return res.end()
        }

        response.badRequest = (message ?: string) => {

            response.status(400)

            message = message ?? `The url '${req.url}' resulted in a bad request. Please review the data and try again.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 400) ,null,2))
            }

            return res.end(JSON.stringify({
                message : message 
            },null,2))
        }

        response.unauthorized = (message ?: string) => {

            response.status(401)

            message = message ?? `The url '${req.url}' is unauthorized. Please verify.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 401) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.paymentRequired = (message ?: string) => {

            response.status(402)

            message = message ?? `The url '${req.url}' requires payment. Please proceed with payment.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 402) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.forbidden = (message ?: string) => {
            response.status(403)

            message = message ?? `The url '${req.url}' is forbidden. Please check the permissions or access rights.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 403) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.notFound = (message ?: string) => {
   
            response.status(404)

            message = message ?? `The url '${req.url}' was not found. Please re-check the your url again`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 404) ,null,2))
            }

            return res.end(JSON.stringify({
                message
            },null,2))
        }

        response.serverError = (message ?: string) => {
           
            response.status(500)

            message = message ?? `The url '${req.url}' resulted in a server error. Please investigate.`

            if(this._formatResponse != null) {
                return res.end(JSON.stringify(this._formatResponse({ message }, 500) ,null,2))
            }

            return res.end(JSON.stringify({
                message 
            },null,2))
        }

        response.status = (code : number) => {

            res.writeHead(code, { 'Content-Type': 'application/json' })
            
            return res as unknown as {
                json : (data?: { [key: string]: any }) => void;
                send : (message : string) => void;
            }
        }

        response.setCookies = (cookies : Record<string,string | { 
            value      : string
            sameSite   ?: 'Strict' | 'Lax' | 'None'
            domain     ?: string
            secure     ?: boolean
            httpOnly   ?: boolean
            expires    ?: Date
        }> ) => {

            for(const [key,v] of Object.entries(cookies)) {
                if(typeof v === 'string') {
                    res.writeHeader('Set-Cookie', `${key}=${v}`);
                    continue
                }

                if(v.value === '' || v.value ==  null) continue

                let str = `${key}=${v.value}`

                if(v.sameSite != null) {
                    str += ` ;SameSite=${v.sameSite}`
                }

                if(v.domain != null) {
                    str += ` ;Domain=${v.domain}`
                }

                if(v.httpOnly != null) {
                    str += ` ;HttpOnly`
                }

                if(v.secure != null) {
                    str += ` ;Secure`
                }

                if(v.expires != null) {
                    str += ` ;Expires=${v.expires.toUTCString()}`
                }

                res.setHeader('Set-Cookie', str);
            }
        }

        return response
    }
   
    private _nextFunction (ctx : TContext) {

        const NEXT_MESSAGE = "The 'next' function does not have any subsequent function."
        
        return (err ?: any) => {
            
            if(err != null) {

                if(this._errorHandler != null) {
                    return this._errorHandler(err,ctx)
                }

                ctx.res.writeHead(500, { 'Content-Type': 'application/json' })

                if(this._formatResponse != null) {
                    return ctx.res.end(JSON.stringify(
                        this._formatResponse({ 
                            message : err?.message,
                        }, ctx.res.statusCode) ,null, 2)
                    )
                }

                return ctx.res.end(JSON.stringify({
                    message : err?.message,
                },null,2));  
            }

            if(this._errorHandler != null) {
                return this._errorHandler(new Error(NEXT_MESSAGE), ctx)
            }

            ctx.res.writeHead(500, { 'Content-Type': 'application/json' })

            if(this._formatResponse != null) {
                return ctx.res.end(JSON.stringify(
                    this._formatResponse({ 
                        message : NEXT_MESSAGE
                    }, ctx.res.statusCode) ,null, 2)
                )
            }
            
            return ctx.res.end(JSON.stringify({
                message : NEXT_MESSAGE
            },null,2));  
        } 
    }

    private _normalizePath (...paths: string[]) : string {
        const path = paths
        .join('/')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')

        const normalizedPath = path.startsWith('/') ? path : `/${path}`
    
        return /\/api\/api/.test(normalizedPath) ? normalizedPath.replace(/\/api\/api\//, "/api/") : normalizedPath
    }

    private _swaggerHandler () {

        const routes = (this.routers as unknown as { routes : any[]})
        .routes.filter(r => ["GET","POST","PUT","PATCH","DELETE"].includes(r.method) && r.path != '/*')
      
        const { 
            path  , 
            html , 
            staticSwaggerHandler, 
            staticUrl 
        } = this._parser.swagger({
            ...this._swagger,
            options : this._swaggerAdditional,
            routes
        })

        this._router.get(staticUrl, staticSwaggerHandler)

        this._router.get(String(path) , (req, res) => {

            res.writeHead(200, {'Content-Type': 'text/html'})

            return res.end(html)
        })

        return
    }

    private _wrapHandlers = (...handlers : ((ctx : TContext , next : TNextFunction) => any)[]) : any => {

        return (req : IncomingMessage, res : ServerResponse , ps : Record<string,any>) => {

            const runHandler = (index : number = 0) : any => {
               try {

                const response = this._customizeResponse(req,res) as TResponse
                
                const request = req as TRequest

                request.params = ps

                const params = ps as TParams
                
                const body = request.body as TBody
                
                const files = request.files as TFiles

                const cookies = request.cookies as TCookies

                const headers = request.headers as THeaders
                
                const query = request.query as TQuery

                const RecordOrEmptyRecord = (data : any) => {
                    if(data == null) return {}
                    return Object.keys(data).length ? data : {}
                }
               
                const ctx = {
                    req : request, 
                    res : response,
                    headers : RecordOrEmptyRecord(headers),
                    params  : RecordOrEmptyRecord(params),
                    query   : RecordOrEmptyRecord(query),
                    body    : RecordOrEmptyRecord(body),
                    files   : RecordOrEmptyRecord(files),
                    cookies : RecordOrEmptyRecord(cookies) 
                }
              
                if(index === handlers.length - 1) {
                    return this._wrapResponse(handlers[index].bind(handlers[index]))(ctx, this._nextFunction(ctx))
                }

                return handlers[index](ctx , () => {
                    return runHandler(index + 1)
                })

               } catch (err) {

                const ctx = {
                    req, 
                    res : this._customizeResponse(req,res), 
                    params : Object.keys(ps).length ? ps : {},
                    headers : {},
                    query : {},
                    body: {},
                    files: {},
                    cookies: {}
                }

                return this._nextFunction(ctx)(err)
               }
            }

            runHandler()
        }
    }

    private _wrapResponse(handler: (ctx: TContext, next: TNextFunction) => any) {
        return (ctx: TContext, next: TNextFunction) => {
            
            Promise.resolve(handler(ctx, next))
            .then(result => {
                
                if (ctx.res.writableEnded) return
    
                if (result instanceof ServerResponse) return

                if (ctx.res.aborted) {
                    
                    return
                }

                if (typeof result === 'string') {
                    return ctx.res.end(result)
                }

                if (this._formatResponse != null) {
                    const formattedResult = this._formatResponse(result, ctx.res.statusCode);

                    if (typeof formattedResult === 'string') {

                        return ctx.res.end(formattedResult)
                    }

                    if (!ctx.res.headersSent) {
                        ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
                    }

                    return ctx.res.end(JSON.stringify(formattedResult, null, 2));
                }

                if (!ctx.res.headersSent) {
                    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
                }

                ctx.res.end(result == null ? undefined : JSON.stringify(result, null, 2));
                return;
            })
            .catch(_ => {

                if (ctx.res.writableEnded) return;

                if (ctx.res.aborted) return

                if (!ctx.res.headersSent) {
                    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
                }

                ctx.res.end(JSON.stringify({ message : 'Internal Server Error' }));

                return;
            })
        };
    }

    private async _createServer () : Promise<any> {
       
        await this._registerMiddlewares()

        await this._registerControllers()

        const server = uWS.App()

        server.any('/*', (uwsRes, uwsReq) => {

            const { req , res } = this._adaptRequestResponse(uwsReq, uwsRes)

            return this._router.lookup(req, res)
        })

        return server
    }

    private _adaptRequestResponse(uwsReq : HttpRequest , uwsRes : HttpResponse) {

        const req  : Record<string,any> = {
          method: String(uwsReq.getMethod()).toLocaleUpperCase(),
          url: uwsReq.getUrl(),
          query: {},
          headers: {}
        }

        req.query = {...(uwsReq.getQuery() == null ? {} : qs.parse(String(uwsReq.getQuery())) || {})}
  
        uwsReq.forEach((key, value) => req.headers[key] = value)
      
        const res = {
            writeHeader: (key : string, value : string) => {
            if (!res.aborted) {
                uwsRes.writeHeader(key, value);
            }
            return res;
          },
          setHeader : (key : string, value : string) => {
            if (!res.aborted) {
                uwsRes.writeHeader(key, value);
            }
            return res;
          },
          writeHead(status : number , context : Record<string,string>){
            
            res.writeHeaders = {
                ...res.writeHeaders,
                [status] : context
            }

            res.headersSent = true

            res.statusCode = status

            return res
          },
          _writeHead(status : number , context : Record<string,string>){
        
            const statusMessages : Record<number,string> = {
                100: 'Continue',
                101: 'Switching Protocols',
                102: 'Processing',
                200: 'OK',
                201: 'Created',
                202: 'Accepted',
                203: 'Non-Authoritative Information',
                204: 'No Content',
                205: 'Reset Content',
                206: 'Partial Content',
                207: 'Multi-Status',
                208: 'Already Reported',
                226: 'IM Used',
                300: 'Multiple Choices',
                301: 'Moved Permanently',
                302: 'Found',
                303: 'See Other',
                304: 'Not Modified',
                305: 'Use Proxy',
                306: '(Unused)',
                307: 'Temporary Redirect',
                308: 'Permanent Redirect',
                400: 'Bad Request',
                401: 'Unauthorized',
                402: 'Payment Required',
                403: 'Forbidden',
                404: 'Not Found',
                405: 'Method Not Allowed',
                406: 'Not Acceptable',
                407: 'Proxy Authentication Required',
                408: 'Request Timeout',
                409: 'Conflict',
                410: 'Gone',
                411: 'Length Required',
                412: 'Precondition Failed',
                413: 'Payload Too Large',
                414: 'URI Too Long',
                415: 'Unsupported Media Type',
                416: 'Range Not Satisfiable',
                417: 'Expectation Failed',
                418: 'I\'m a teapot',
                421: 'Misdirected Request',
                422: 'Unprocessable Entity',
                423: 'Locked',
                424: 'Failed Dependency',
                425: 'Too Early',
                426: 'Upgrade Required',
                428: 'Precondition Required',
                429: 'Too Many Requests',
                431: 'Request Header Fields Too Large',
                451: 'Unavailable For Legal Reasons',
                500: 'Internal Server Error',
                501: 'Not Implemented',
                502: 'Bad Gateway',
                503: 'Service Unavailable',
                504: 'Gateway Timeout',
                505: 'HTTP Version Not Supported',
                506: 'Variant Also Negotiates',
                507: 'Insufficient Storage',
                508: 'Loop Detected',
                510: 'Not Extended',
                511: 'Network Authentication Required'
            };

            const statusMessage = statusMessages[status] || statusMessages[500]

            res.uwsRes.writeStatus(`${status} ${statusMessage}`)

            res.uwsRes.writeHeader(Object.keys(context)[0], Object.values(context)[0])

            return res
          },
          writeStatus: (status : string) => {
            if (!res.aborted) {
                res.uwsRes.writeStatus(status as any);
            }
            return res;
          },
          end: (ctx : string) => {

            uwsRes.cork(() => {
                if(!res.aborted) {
                    res.aborted = true
    
                    for(const h in res.writeHeaders) {
                        //@ts-ignore
                        res._writeHead(h , res.writeHeaders[h])
                    }

                    uwsRes.end(ctx)

                    if(this._onFinished != null) {
                        this._onFinished()
                    }
                    
                    return
                }
            })
          },
          aborted: false,
          writeHeaders : {},
          headersSent: false,
          statusCode : 200,
          uwsRes,
        };
      
        uwsRes.onAborted(() => {
          res.aborted = true;
        });
      
        return { req, res } as unknown as { req : IncomingMessage, res : ServerResponse }
    }
      
}

export class Application extends Spear {}
export { Spear }
export default Spear
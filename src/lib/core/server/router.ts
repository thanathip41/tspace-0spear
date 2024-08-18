import type { 
    TContext, 
    TMethods, 
    TNextFunction 
} from "../types"

class Router {

    private _routes : {
        path : string;
        method : TMethods
        handlers : ((ctx : TContext , next : TNextFunction) => any)[]
    }[] = []

    get routes () {
        return this._routes
    }

    /**
     * The 'groups' method is used to add the request handler to the router for 'GET' 'POST' 'PUT' 'PATCH' 'DELETE' methods.
     * 
     * @param {string} prefix
     * @param {Router} router
     * @returns {void}
     */
    groups (prefix : `/${string}`, router : (router : Router) => Router): void {
        const routes =  router(new Router())
        for(const route of routes._routes) {
            route.path = `${prefix}${route.path}`.replace(/^\/+/, '/')
            this._routes.push(route)
        }
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
    get(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'get',
            handlers
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
    post(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'post',
            handlers
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
    put(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'put',
            handlers
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
    patch(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'patch',
            handlers
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
    delete(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'delete',
            handlers
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
    all(path : `/${string}` , ...handlers : ((ctx : TContext , next : TNextFunction) => any)[]): this {
        this._routes.push({
            path,
            method : 'all',
            handlers
        })
        return this
    }
}

export { Router }
export default Router
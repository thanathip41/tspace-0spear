export const Controller = (path: `/${string}`): ClassDecorator => {
  return (target) => {
    Reflect.defineMetadata("controllers", path, target);
  };
}

import fs from "fs";
import path from "path";

export function getRoutesWithExportedRoute(
  basePath: string,
  dir: string,
  exportedRoutes: string[] = [],
  filesWithoutExportedRoutes: string[] = []
) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getRoutesWithExportedRoute(
        basePath,
        fullPath,
        exportedRoutes,
        filesWithoutExportedRoutes
      );
    } else {
      const fileName = path.basename(fullPath);
      if (
        fileName === "_app.tsx" ||
        fileName === "_document.tsx" ||
        fileName.startsWith("_") ||
        ![".tsx", ".js"].includes(path.extname(fullPath))
      ) {
        return;
      }

      const fileContent = fs.readFileSync(fullPath, "utf8");
      const hasExportedRouteType = /export\s+type\s+RouteType\b/.test(
        fileContent
      );

      let routePath = fullPath
        .replace(basePath, "")
        .replace(/\\/g, "/")
        .replace(/\/index\.(tsx|js)$/, "")
        .replace(/\.(tsx|js)$/, "");

      if (fileName === "index.tsx" || fileName === "index.js") {
        if (dir === basePath) {
          routePath = "/";
        } else {
          routePath = routePath.replace(/\/index$/, "");
        }
      }

      if (hasExportedRouteType) {
        exportedRoutes.push(routePath);
      } else {
        filesWithoutExportedRoutes.push(routePath);
      }
    }
  });

  return { exportedRoutes, filesWithoutExportedRoutes };
}

export function generateTypesFile(
  hasRoute: string[],
  doesntHaveRoute: string[]
): void {
  let importStatements = "";
  let routeCounter = 0;

  for (const route of hasRoute) {
    const routeVariableName = `Route_${routeCounter}`;
    importStatements += `import { type RouteType as ${routeVariableName} } from "~/pages${route}";\n`;
    routeCounter++;
  }

  const routeTypeDeclarations = hasRoute
    .map(
      (route) => `  "${route}": InferRoute<Route_${hasRoute.indexOf(route)}>;`
    )
    .join("\n");

  const staticRoutesDeclarations = doesntHaveRoute
    .map((route) => `  "${route}": StaticRoute;`)
    .join("\n");

  const additionalTypeDeclarations = `
export type AppRouter = StaticRouter & DynamicRouter;

type StaticRoutes = keyof StaticRouter;
type DynamicRoutes = keyof DynamicRouter;

import { type z } from "zod";
import { type GetServerSidePropsContext } from "next";

type StaticRoute = {
  searchParams: undefined;
  routeParams: undefined;
};

type DynamicRoute = {
  searchParams: z.AnyZodObject | undefined;
  routeParams: z.AnyZodObject | undefined;
};

type InferRoute<T extends DynamicRoute> = {
  searchParams: HandleUndefined<T["searchParams"]>;
  routeParams: HandleUndefined<T["routeParams"]>;
};

type PathOptions<T extends AllRoutes> = T extends StaticRoutes
  ? StaticPathOptions<T>
  : DynamicRouteOptions<T>;

type HandleUndefined<T extends z.AnyZodObject | undefined> =
  T extends z.AnyZodObject ? z.infer<T> : undefined;

type DynamicRouteOptions<T extends DynamicRoutes> =
  RouteParams<T> extends undefined
    ? SearchParams<T> extends undefined
      ? // Both are undefined
        Option4<T>
      : // Only routeParams is undefined
        Option2<T>
    : SearchParams<T> extends undefined
    ? // Only searchParams is undefined
      Option3<T>
    : // Neither are undefined
      Option1<T>;

type Option1<T extends DynamicRoutes> = {
  route: T;
  searchParams: SearchParams<T>;
  routeParams: RouteParams<T>;
};

type Option2<T extends DynamicRoutes> = {
  route: T;
  searchParams: SearchParams<T>;
  routeParams?: undefined;
};

type Option3<T extends DynamicRoutes> = {
  route: T;
  searchParams?: undefined;
  routeParams: RouteParams<T>;
};

type Option4<T extends DynamicRoutes> = {
  route: T;
  searchParams?: undefined;
  routeParams?: undefined;
};

type StaticPathOptions<T extends StaticRoutes> = {
  route: T;
  searchParams?: undefined;
  routeParams?: undefined;
};

export type InferServerSideParamsType<T extends DynamicRoute> = z.infer<
  T["routeParams"]
> &
  z.infer<T["searchParams"]>;

type AllRoutes = keyof AppRouter;

type SearchParams<T extends AllRoutes> = AppRouter[T]["searchParams"];
type RouteParams<T extends AllRoutes> = AppRouter[T]["routeParams"];

type UseParamsResult<T extends z.AnyZodObject> =
  | {
      data: z.infer<T>;
      isValid: true;
      isReady: true;
      isError: false;
      error: undefined;
    }
  | {
      data: undefined;
      isValid: false;
      isReady: true;
      isError: true;
      error: z.ZodError<T>;
    }
  | {
      data: undefined;
      isValid: false;
      isReady: false;
      isError: false;
      error: undefined;
    };

declare function $path<T extends AllRoutes>({ route, searchParams, routeParams, }: PathOptions<T>): string;
declare function useRouteParams<T extends z.AnyZodObject>(validator: T): UseParamsResult<T>;
declare function useSearchParams<T extends z.AnyZodObject>(searchValidator: T): UseParamsResult<T>;

declare function parseServerSideSearchParams<T extends z.AnyZodObject>({ context, validator, }: {
    context: GetServerSidePropsContext;
    validator: T;
}): z.infer<T>;
declare function parseServerSideRouteParams<T extends z.AnyZodObject>({ context, validator, }: {
    context: GetServerSidePropsContext;
    validator: T;
}): z.infer<T>;

export { $path, parseServerSideRouteParams, parseServerSideSearchParams, useRouteParams, useSearchParams };`;

  const fileContentString = `${importStatements}\ntype DynamicRouter = {\n${routeTypeDeclarations}\n};\n\ntype StaticRouter = {\n${staticRoutesDeclarations}\n};\n${additionalTypeDeclarations}\n`;

  fs.writeFileSync(
    "node_modules/next-typesafe-url/dist/index.d.ts",
    fileContentString
  );
}

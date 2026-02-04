import type {
	EndpointContext,
	EndpointOptions,
	StrictEndpoint,
} from "better-call";
import { createEndpoint, createMiddleware } from "better-call";
import { runWithEndpointContext } from "../context";
import type { AuthContext } from "../types";
import type { StandardSchemaV1 } from '@standard-schema/spec'

export const optionsMiddleware = createMiddleware(async () => {
	/**
	 * This will be passed on the instance of
	 * the context. Used to infer the type
	 * here.
	 */
	return {} as AuthContext;
});

export const createAuthMiddleware = createMiddleware.create({
	use: [
		optionsMiddleware,
		/**
		 * Only use for post hooks
		 */
		createMiddleware(async () => {
			return {} as {
				returned?: unknown | undefined;
				responseHeaders?: Headers | undefined;
			};
		}),
	],
});

const use = [optionsMiddleware];

type EndpointHandler<
	Path extends string,
	Options extends EndpointOptions,
	R,
> = (context: EndpointContext<Path, Options, AuthContext>) => Promise<R>;

type DefaultAuthContext = AuthContext & {
	returned?: unknown | undefined;
	responseHeaders?: Headers | undefined;
} & Record<string, any>

type AuthMiddleware2 = (...args: any[]) => Promise<any>;

type AuthEndpointOptions<
	Method extends string,
	Query,
	Body,
	Middleware extends AuthMiddleware2[]
> = {
	method: Method | Method[];
	query?: StandardSchemaV1<Query>
	body?: StandardSchemaV1<Body>
	use: Middleware
} & Record<string, unknown>

type InferAuthMiddleware2Returns<Middleware extends AuthMiddleware2[]> =
	Middleware extends [infer First, ...infer Rest]
		? First extends (...args: any[]) => infer R
			? Rest extends AuthMiddleware2[] ? Awaited<R> & InferAuthMiddleware2Returns<Rest>
				: Awaited<R>
			: never
		: {}

type AuthEndpointContext<
	Path extends string,
	Method extends string,
	Query,
	Body,
	Middleware extends AuthMiddleware2[]
> = {
	path: Path;
	method: Method | Method[];
	query?: Query
	body?: Body
	context: InferAuthMiddleware2Returns<Middleware> & DefaultAuthContext
}

export interface AuthEndpointV2<
	Path extends string,
	Method extends string,
	Query,
	Body,
	Middleware extends AuthMiddleware2[]
> {
	(context: AuthEndpointContext<Path, Method, Query, Body, Middleware>): Promise<any>
}

export function createAuthEndpointV2 <
	Path extends string,
	Method extends string,
	Query,
	Body,
	const Middleware extends AuthMiddleware2[]
>(
	path: Path,
	options: AuthEndpointOptions<Method, Query, Body, Middleware>,
	handler: (context: AuthEndpointContext<Path, Method, NoInfer<Query>, NoInfer<Body>, Middleware>) => Promise<any>
): AuthEndpointV2<Path, Method, Query, Body, Middleware> {
	return createEndpoint(
		path,
		{
			...options,
			use: [...(options?.use || []), ...use],
		} as any,
		async (ctx) => runWithEndpointContext(ctx as any, () => handler(ctx as any)),
	) as any;
}

export function createAuthEndpoint<
	Path extends string,
	Options extends EndpointOptions,
	R,
>(
	path: Path,
	options: Options,
	handler: EndpointHandler<Path, Options, R>,
): StrictEndpoint<Path, Options, R>;

export function createAuthEndpoint<
	Path extends string,
	Options extends EndpointOptions,
	R,
>(
	options: Options,
	handler: EndpointHandler<Path, Options, R>,
): StrictEndpoint<Path, Options, R>;

export function createAuthEndpoint<
	Path extends string,
	Opts extends EndpointOptions,
	R,
>(
	pathOrOptions: Path | Opts,
	handlerOrOptions: EndpointHandler<Path, Opts, R> | Opts,
	handlerOrNever?: any,
) {
	const path: Path | undefined =
		typeof pathOrOptions === "string" ? pathOrOptions : undefined;
	const options: Opts =
		typeof handlerOrOptions === "object"
			? handlerOrOptions
			: (pathOrOptions as Opts);
	const handler: EndpointHandler<Path, Opts, R> =
		typeof handlerOrOptions === "function" ? handlerOrOptions : handlerOrNever;

	if (path) {
		return createEndpoint(
			path,
			{
				...options,
				use: [...(options?.use || []), ...use],
			},
			// todo: prettify the code, we want to call `runWithEndpointContext` to top level
			async (ctx) => runWithEndpointContext(ctx as any, () => handler(ctx)),
		);
	}

	return createEndpoint(
		{
			...options,
			use: [...(options?.use || []), ...use],
		},
		// todo: prettify the code, we want to call `runWithEndpointContext` to top level
		async (ctx) => runWithEndpointContext(ctx as any, () => handler(ctx)),
	);
}

export type AuthEndpoint<
	Path extends string,
	Opts extends EndpointOptions,
	R,
> = ReturnType<typeof createAuthEndpoint<Path, Opts, R>>;
export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;

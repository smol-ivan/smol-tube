import { DynamoRoomRepository } from "../repositories/DynamoRoomRepository";
import { DynamoConnectionRepository } from "../repositories/DynamoConnectionRepository";
import { DynamoUserRepository } from "../repositories/DynamoUserRepository";
import { ApiGatewayManagementApiClient } from "@aws-sdk/client-apigatewaymanagementapi";

export const connectionRepo = new DynamoConnectionRepository(
    process.env.CONNECTIONS_TABLE!,
);
export const userRepo = new DynamoUserRepository(process.env.USERS_TABLE!);
export const roomRepo = new DynamoRoomRepository(process.env.ROOMS_TABLE!);
export const apiGw = new ApiGatewayManagementApiClient({
    endpoint: process.env.API_GW_ENDPOINT!,
});

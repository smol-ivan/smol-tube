import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
    // API Gateway solo requiere un statusCode 200 para aceptar el socket TCP inicial
    return { statusCode: 200 };
};

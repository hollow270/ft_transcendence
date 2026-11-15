import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';

const socketOrigins = (
  process.env.APP_ALLOWED_ORIGINS ??
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: socketOrigins,
    methods: ['GET', 'POST'],
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly auth: AuthService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const header = client.handshake.headers.authorization;
      const authorization =
        typeof token === 'string'
          ? `Bearer ${token}`
          : typeof header === 'string'
            ? header
            : undefined;

      const user =
        await this.auth.requireUserFromAuthorization(authorization);

      client.data.userId = user.id;
      await client.join(`user:${user.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}

import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';

const socketOrigins = (
  process.env.APP_ALLOWED_ORIGINS ??
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080,https://localhost:8443,https://127.0.0.1:8443'
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
export class NotificationsGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly auth: AuthService) {}

  afterInit(server: Server) {
    const timer = setInterval(() => {
      server.to('admins').emit(
        'admin:metrics',
        {
          at: new Date().toISOString(),
        },
      );
    }, 5000);

    timer.unref();
  }

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
      client.data.role = user.role;
      await client.join(`user:${user.id}`);

      if (user.role === 'ADMIN') {
        await client.join('admins');
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    client.data.userId = undefined;
    client.data.role = undefined;
  }

  emitAdminMetricsChanged(
    payload: Record<string, unknown> = {},
  ) {
    this.server.to('admins').emit(
      'admin:metrics',
      {
        at: new Date().toISOString(),
        ...payload,
      },
    );
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}

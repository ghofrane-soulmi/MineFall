import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

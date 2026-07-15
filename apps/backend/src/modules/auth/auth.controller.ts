import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ClientTokenDto } from './dto/client-token.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Authenticate an admin user for the management UI' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() input: LoginDto, @Headers('x-request-id') requestId?: string) {
    return this.authService.login(input, requestId);
  }

  @ApiOperation({ summary: 'Issue a client access token for external integrations' })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('token')
  token(@Body() input: ClientTokenDto) {
    return this.authService.issueClientToken(input);
  }

  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token pair' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() input: RefreshTokenDto, @Headers('x-request-id') requestId?: string) {
    return this.authService.refreshUserToken(input.refreshToken, requestId);
  }

  @ApiOperation({ summary: 'Revoke active refresh token family for user session sign-out' })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('logout')
  logout(@Body() input: LogoutDto, @Headers('x-request-id') requestId?: string) {
    return this.authService.logoutUserSession(input.refreshToken, requestId);
  }
}

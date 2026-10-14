import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ACCESS_TOKEN_COOKIE, accessTokenCookieOptions, AUTH_THROTTLE, AuthService, AuthUser, CurrentUser, LoginDto, RegisterDto } from '@app/shared';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // puts the token in an httpOnly cookie that lives exactly as long as the JWT
  private setAuthCookie(res: Response, accessToken: string) {
    const exp = (this.jwtService.decode(accessToken) as { exp: number }).exp;
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions(this.configService, new Date(exp * 1000)));
  }

  // creates the user and their wallet, then logs them in via cookie
  @Post('register')
  @ApiOperation({ summary: 'Register a new user and create their wallet (sets the access_token cookie)' })
  @ApiResponse({ status: 201, description: 'User registered' })
  @ApiConflictResponse({ description: 'Email already registered' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @Throttle(AUTH_THROTTLE)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, ...body } = await this.authService.register(dto);
    this.setAuthCookie(res, accessToken);
    return body;
  }

  // checks credentials and sets the JWT cookie
  @Post('login')
  @ApiOperation({ summary: 'Log in (sets the access_token cookie)' })
  @ApiResponse({ status: 200, description: 'Logged in' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, ...body } = await this.authService.login(dto);
    this.setAuthCookie(res, accessToken);
    return body;
  }

  // clears the JWT cookie
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log out (clears the access_token cookie)' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, accessTokenCookieOptions(this.configService));
    return { message: 'Logged out' };
  }

  // returns the logged-in user with their wallet
  @Get('isAuthenticated')
  @ApiOperation({ summary: 'Get the authenticated user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  isAuthenticated(@CurrentUser() user: AuthUser) {
    return this.authService.isUserAuthenticated(user.id);
  }
}

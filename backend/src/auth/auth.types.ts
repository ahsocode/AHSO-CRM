import { RoleValue } from "../common/constants/role.constants";

export interface JwtUser {
  sub: string;
  email: string;
  name: string;
  role: RoleValue;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

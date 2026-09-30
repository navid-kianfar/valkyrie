import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class TlsDto {
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsBoolean() skipVerify?: boolean;
  @IsOptional() @IsString() @MaxLength(20000) caCert?: string;
  @IsOptional() @IsString() @MaxLength(255) sni?: string;
}

export class SshDto {
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsString() host?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() privateKey?: string;
}

export class CreateSourceDto {
  @IsString() @MinLength(1) @MaxLength(64) name: string;
  @IsOptional() @IsString() @MaxLength(64) group?: string;
  @IsString() @MinLength(1) @MaxLength(255) host: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsString() @MaxLength(120) username?: string;
  @IsOptional() @IsString() @MaxLength(500) password?: string;
  @IsOptional() @IsIn(['standalone', 'replica', 'cluster', 'sentinel']) mode?: string;
  @IsOptional() @ValidateNested() @Type(() => TlsDto) tls?: TlsDto;
  @IsOptional() @ValidateNested() @Type(() => SshDto) ssh?: SshDto;
  @IsOptional() @IsString() @MaxLength(120) sentinelMaster?: string;
  @IsOptional() @IsBoolean() readOnly?: boolean;
  @IsOptional() @IsBoolean() guardDangerous?: boolean;
  @IsOptional() @IsInt() @Min(10) @Max(10000) scanCount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(16) visibleDbs?: number;
}

export class UpdateSourceDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(64) name?: string;
  @IsOptional() @IsString() @MaxLength(64) group?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) host?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsString() @MaxLength(120) username?: string;
  @IsOptional() @IsString() @MaxLength(500) password?: string;
  @IsOptional() @IsIn(['standalone', 'replica', 'cluster', 'sentinel']) mode?: string;
  @IsOptional() @ValidateNested() @Type(() => TlsDto) tls?: TlsDto;
  @IsOptional() @ValidateNested() @Type(() => SshDto) ssh?: SshDto;
  @IsOptional() @IsString() @MaxLength(120) sentinelMaster?: string;
  @IsOptional() @IsBoolean() readOnly?: boolean;
  @IsOptional() @IsBoolean() guardDangerous?: boolean;
  @IsOptional() @IsInt() @Min(10) @Max(10000) scanCount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(16) visibleDbs?: number;
}

export class TestSourceDto extends CreateSourceDto {}

export class ScanNetworkDto {
  @IsString() @MinLength(7) @MaxLength(20) cidr: string;
  @IsArray() @IsInt({ each: true }) @Min(1, { each: true }) @Max(65535, { each: true }) ports: number[];
}

export class ImportSourcesDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateSourceDto) items: CreateSourceDto[];
}

export class SetConfigDto {
  @IsObject() entries: Record<string, string>;
}

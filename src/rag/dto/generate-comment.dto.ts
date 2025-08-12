import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
  IsObject,
  IsBoolean,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum BiomarkerStatus {
    LOW = 'Low',
    MODERATELY_LOW = 'Moderately Low',
    HEALTHY = 'Healthy',
    MODERATELY_HIGH = 'Moderately High',
    HIGH = 'High',
}

export enum PatientGoal {
  LOSE_WEIGHT = 'lose weight',
  IMPROVE_WELLBEING = 'improve wellbeing',
  INCREASE_FITNESS = 'increase fitness',
  OPTIMISE_PERFORMANCE = 'optimise performance',
  MONITOR_CONDITION = 'monitor existing condition',
}


// This DTO is used to capture the patient's profile information.
class PatientDto {
  @IsNumber()
  age: number;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsString()
  @IsNotEmpty()
  sexAtBirth: string;

  @IsNumber()
  @IsOptional()
  weightKg?: number;

  @IsNumber()
  @IsOptional()
  heightCm?: number;
  
  @IsString()
  @IsNotEmpty()
  ethnicity: string;

  @IsBoolean()
  isSmoker: boolean;

  @IsString()
  @IsNotEmpty()
  alcoholConsumption: string;

  @IsString()
  @IsNotEmpty()
  exercise: string;

  @IsString()
  @IsNotEmpty()
  dietType: string;

  @IsBoolean()
  @IsOptional()
  isTransitioning?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supplements?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  conditions?: string[];

  @IsEnum(PatientGoal)
  @IsOptional()
  goal?: PatientGoal;

  @IsString()
  @IsOptional()
  sportOrExercise?: string;

  @IsString()
  @IsOptional()
  sportFrequency?: string

  @IsString()
  @IsOptional()
  trainingInformation?: string

  @IsString()
  @IsOptional()
  additionalInformation?: string;
}

// DTO for biomarker results
class BiomarkerResultDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsEnum(BiomarkerStatus)
  @IsNotEmpty()
  status: BiomarkerStatus;
}

// DTO for previous profile
class PrevProfileDto {
  @IsNumber()
  @IsOptional()
  weightKg?: number;
  
  @IsBoolean()
  @IsOptional()
  isSmoker?: boolean;

  @IsString()
  @IsOptional()
  alcoholConsumption?: string;

  @IsString()
  @IsOptional()
  exercise?: string;

  @IsString()
  @IsOptional()
  dietType?: string;

  @IsBoolean()
  @IsOptional()
  isTransitioning?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supplements?: string[];

  @IsEnum(PatientGoal)
  @IsOptional()
  goal?: PatientGoal;

  @IsString()
  @IsOptional()
  sportOrExercise?: string;

  @IsString()
  @IsOptional()
  sportFrequency?: string;

  @IsString()
  @IsOptional()
  trainingInformation?: string;

  @IsString()
  @IsOptional()
  additionalInformation?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  conditions?: string[];
}

// DTO for previous data
class PrevDataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BiomarkerResultDto)
  @IsOptional()
  results?: BiomarkerResultDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => PrevProfileDto)
  @IsOptional()
  profile?: PrevProfileDto;
}

// DTO mainly for the request
export class GenerateCommentDto {
  @IsObject()
  @ValidateNested()
  @Type(() => PatientDto)
  patient: PatientDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BiomarkerResultDto)
  results: BiomarkerResultDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => PrevDataDto)
  @IsOptional()
  prevData?: PrevDataDto;
}

import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDateString, IsOptional, IsString, IsUUID } from "class-validator";
import { IsNumberString } from "class-validator";
import { IsEnum } from "class-validator";


export enum FilterDriverSortOptions {
    CREATED_AT = 'createdAt',
    UPDATED_AT = 'updatedAt',
    NAME = 'name',
    MOST_DOCUMENTS_UPLOADED = 'mostDocumentsUploaded',
    LEAST_DOCUMENTS_UPLOADED = 'leastDocumentsUploaded',
}

export enum FilterDriverSortOrderOptions {
    ASC = 'asc',
    DESC = 'desc',
}

export enum FilterDriverStatusOptions {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    IN_REVIEW = 'IN_REVIEW',
    ONBOARDING = 'ONBOARDING'
}

export class FilterDriverDto {
    @ApiProperty({
        type: Number,
        description: 'Limit the number of results',
        default: 10,
        required: false,
    })
    @IsOptional()
    @IsNumberString()
    readonly pageSize: number = 10;

    @ApiProperty({
        type: Number,
        description: 'The page number',
        default: 1,
        required: false,
    })
    @IsOptional()
    @IsNumberString()
    readonly page: number = 1;

    @ApiProperty({
        type: 'string',
        description: Object.values(FilterDriverSortOptions).join('/'),
        required: false,
        example: FilterDriverSortOptions.CREATED_AT,
    })
    @IsOptional()
    @IsEnum(FilterDriverSortOptions)
    readonly sortBy = FilterDriverSortOptions.CREATED_AT;

    @ApiProperty({
        type: 'string',
        description: Object.values(FilterDriverSortOrderOptions).join('/'),
        required: false,
        example: FilterDriverSortOrderOptions.ASC,
    })
    @IsOptional()
    @IsEnum(FilterDriverSortOrderOptions)
    readonly sortOrder = FilterDriverSortOrderOptions.ASC;

    @ApiProperty({
        type: Number,
        description: '1000',
        required: false,
        example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
    })
    @IsOptional()
    @IsUUID()
    readonly vehicleId!: string;

    @ApiProperty({
        type: Array,
        description: 'The fields to include in the response',
        required: false,
        example: ['id', 'name', 'phone', 'createdAt', 'updatedAt'],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    readonly fields: string[] = [];

    @ApiProperty({
        type: String,
        description: 'The search term',
        required: false,
        example: 'Karim Mia',
    })
    @IsOptional()
    @IsString()
    readonly search!: string;

    @ApiProperty({
        type: 'string',
        description: Object.values(FilterDriverStatusOptions).join('/'),
        required: false,
        example: FilterDriverStatusOptions.ACTIVE,
    })
    @IsOptional()
    @IsEnum(FilterDriverStatusOptions)
    readonly status = FilterDriverStatusOptions.ACTIVE;


    @ApiProperty({
        type: 'string',
        description: 'The start date',
        required: false,
        example: '2025-01-01',
    })
    @IsOptional()
    @IsDateString()
    readonly startDate!: string;

    @ApiProperty({
        type: 'string',
        description: 'The end date',
        required: false,
        example: '2025-01-01',
    })
    @IsOptional()
    @IsDateString()
    readonly endDate!: string;
}
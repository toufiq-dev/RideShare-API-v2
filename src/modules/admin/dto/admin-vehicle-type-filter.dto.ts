import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDateString, IsOptional, IsString, IsUUID } from "class-validator";
import { IsNumberString } from "class-validator";
import { IsEnum } from "class-validator";


// export enum FilterVehicleTypeBDSortOrderOptions {
//     ASC = 'asc',
//     DESC = 'desc',
// }


export class FilterVehicleTypeBDFilterDto {
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


    // @ApiProperty({
    //     type: 'string',
    //     description: Object.values(FilterVehicleTypeBDSortOrderOptions).join('/'),
    //     required: false,
    //     example: FilterVehicleTypeBDSortOrderOptions.ASC,
    // })
    // @IsOptional()
    // @IsEnum(FilterVehicleTypeBDSortOrderOptions)
    // readonly sortOrder = FilterVehicleTypeBDSortOrderOptions.ASC;

    @ApiProperty({
        type: 'string',
        description: 'The search term',
        required: false,
        example: 'Vehicle 1',
    })
    @IsOptional()
    @IsString()
    readonly search!: string;


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
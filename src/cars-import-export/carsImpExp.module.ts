import { QueryBuilder } from '@classes/queryBuilder';
import { Module } from '@nestjs/common';
import { CarsImpExpController } from 'src/cars-import-export/carsImpExp.controller';
import { CarsImpExpService } from './carsImpExp.service';

@Module({
  controllers: [CarsImpExpController],
  providers: [CarsImpExpService, QueryBuilder],
})
export class CarsImpExpModule {}

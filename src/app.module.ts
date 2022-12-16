import { Pool } from 'pg';
import { Module, OnModuleInit } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  formatDate,
  getDayDiff,
  isWeekEndDay,
  countRentalPrice,
} from './common/helpers';
import { CarModule } from './car/car.module';
import { RentModule } from './rent/rent.module';
import { CarsImpExpModule } from './cars-import-export/carsImpExp.module';

interface Car {
  readonly name: number;
  readonly LP: string;
}

interface Rental {
  readonly carId: number;
  readonly dateFrom: Date;
  readonly dateTo: Date;
  readonly totalPrice: number;
}

@Module({
  imports: [
    CarModule,
    RentModule,
    ConfigModule.forRoot({ isGlobal: true }),
    CarsImpExpModule,
  ],
})
export class AppModule implements OnModuleInit {
  conn: any;
  constructor(private config: ConfigService) {
    this.conn = new Pool({
      user: this.config.get('DB_USER'),
      host: this.config.get('DB_HOST'),
      database: this.config.get('DB_NAME'),
      password: this.config.get('DB_PASSWORD'),
      port: this.config.get('DB_PORT'),
    });
  }

  private generateCars(): Array<Car> {
    const carTestData = [];

    for (let i = 0; i < 5; i++) {
      const carObject = {
        name: faker.vehicle.vehicle(),
        LP: faker.vehicle.vrm(),
      };
      carTestData.push(carObject);
    }
    return carTestData;
  }

  private generateRentals(): Array<Rental> {
    const rentListData = [];

    while (rentListData.length < 50) {
      const numberOfDays = Math.floor(Math.random() * 30) + 1;

      const dateFrom = new Date(
        formatDate(
          faker.date.between(
            '2017-01-01T00:00:00.000Z',
            `${Number(new Date().getFullYear()) + 1}-01-01T00:00:00.000Z`,
          ),
        ),
      );

      const dateTo = new Date(dateFrom.getTime());
      dateTo.setDate(Number(dateTo.getDate()) + numberOfDays);

      if (isWeekEndDay(dateFrom)) {
        dateFrom.setDate(Number(dateFrom.getDate()) - 2);
      }
      if (isWeekEndDay(dateTo)) {
        dateTo.setDate(Number(dateTo.getDate()) + 2);
      }

      const totalDays = getDayDiff(dateTo, dateFrom);
      const id = Math.floor(Math.random() * 5) + 1;
      const foundCarIndex = rentListData.findIndex((el) => el.id === id);

      if (foundCarIndex > -1) {
        const dateFromWithDelay = dateFrom;
        const dateFromDiff = dateFromWithDelay.getDate() - 3;
        dateFromWithDelay.setDate(dateFromDiff);

        const dateToWithDelay = dateTo;
        const dateToDiff = dateToWithDelay.getDate() + 3;
        dateToWithDelay.setDate(dateToDiff);

        if (
          !(rentListData[foundCarIndex].dateFrom >= dateFromWithDelay) &&
          !(rentListData[foundCarIndex].dateFrom <= dateToWithDelay) &&
          !(rentListData[foundCarIndex].dateTo >= dateFromWithDelay) &&
          !(rentListData[foundCarIndex].dateTo <= dateToWithDelay)
        ) {
          rentListData.push({
            carId: id,
            dateFrom,
            dateTo,
            totalPrice: countRentalPrice(totalDays),
          });
        }
      } else {
        rentListData.push({
          carId: id,
          dateFrom,
          dateTo,
          totalPrice: countRentalPrice(totalDays),
        });
      }
    }
    return rentListData;
  }

  private async seed() {
    const carTestData = this.generateCars();
    const rentListData = this.generateRentals();

    const carsQueryString = carTestData.reduce(
      (queryString, valuesString, index) => {
        queryString += `('${valuesString.name}', '${valuesString.LP}') ${
          index < carTestData.length - 1 ? ',' : ''
        }`;
        return queryString;
      },
      `INSERT INTO car (name, "LP") VALUES `,
    );

    const rentalQueryString = rentListData.reduce(
      (queryString, valuesString, index) => {
        queryString += `('${valuesString.carId}', '${formatDate(
          valuesString.dateFrom,
        )}', '${formatDate(valuesString.dateTo)}', '${
          valuesString.totalPrice
        }') ${index < rentListData.length - 1 ? ',' : ''}`;
        return queryString;
      },
      `INSERT INTO "rent_list" ("carId", "dateFrom", "dateTo", "totalPrice") VALUES `,
    );

    await this.conn.query(carsQueryString);
    await this.conn.query(rentalQueryString);
  }

  private async checkTableExist(tableName: string): Promise<boolean> {
    const existQuery = `SELECT EXISTS (
      SELECT 1 FROM 
          pg_tables
      WHERE 
          schemaname = 'public' AND 
          tablename  = '${tableName}'
      )`;
    const answer = await this.conn.query(existQuery);
    return answer.rows[0].exists;
  }

  async onModuleInit() {
    const carTableExist = await this.checkTableExist('car');
    const rentListTableExist = await this.checkTableExist('rent_list');
    const carQuery = `CREATE TABLE "car" (
      id SERIAL PRIMARY KEY,
      name VARCHAR (50) NOT NULL,
      "LP" VARCHAR (7) UNIQUE NOT NULL
    )`;
    const rentListQuery = `CREATE TABLE "rent_list" (
      id SERIAL PRIMARY KEY,
      "carId" SMALLINT NOT NULL,
      "dateFrom" timestamp without time zone NOT NULL,
      "dateTo" timestamp without time zone NOT NULL,
      "totalPrice" double precision
    )`;
    try {
      if (!carTableExist && !rentListTableExist) {
        await this.conn.query(carQuery);
        await this.conn.query(rentListQuery);
        this.seed();
      }
    } catch (err) {
      console.log(err);
    }
  }
}

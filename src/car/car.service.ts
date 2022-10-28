import { Injectable } from '@nestjs/common';
import { QueryBuilder } from 'src/common/queryBuilder';
import { formatDate } from 'src/common/helpers';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CarService {
  constructor(
    private queryBuilder: QueryBuilder,
    private config: ConfigService,
  ) {}

  async checkAvaliability(dto: { id: number; dateFrom: Date; dateTo: Date }) {
    const { id, dateFrom, dateTo } = dto;

    const dateFromFinalDate = new Date(dateFrom);
    const dateFromDiff = dateFromFinalDate.getDate() + 3;
    dateFromFinalDate.setDate(dateFromDiff);

    const dateToFinalDate = new Date(dateTo);
    const dateToDiff = dateToFinalDate.getDate() + 3;
    dateToFinalDate.setDate(dateToDiff);

    const query = `SELECT * FROM car WHERE id NOT IN (SELECT "carId" FROM rent_list 
    WHERE 'rent_list.dateFrom' >= '${dateFromFinalDate}' 
    AND 'rent_list.dateTo' <= '${dateToFinalDate}')`;
    const avaliableCars = await this.queryBuilder.runQuery(query);
    if (id) {
      const avaliableCarIndex = avaliableCars.findIndex(
        (car: { id: number; name: string; LP: string }) => car.id === id,
      );
      return { carId: id, avaliable: avaliableCarIndex > -1 };
    }
    return avaliableCars;
  }

  async checkAvgCarEmployment(dto) {
    const { id, month } = dto;
    const [year, monthNum] = month.split('-');

    //get month's first and last day
    const startDate = new Date(`${year}-${monthNum}-01`);
    const endDate = new Date(`${year}-${Number(monthNum) + 1}-01`);

    //get correct dates
    const dateFrom: string = formatDate(startDate);
    const dateTo: string = formatDate(endDate);
    const daysInMonth: number =
      (new Date(dateTo).valueOf() - new Date(dateFrom).valueOf()) /
      (24 * 60 * 60 * 1000);

    const query = `SELECT "rent_list"."carId", rent_list.id AS "rentalId", car."LP", 
    "rent_list"."dateFrom" AT TIME ZONE 'GMT' AT TIME ZONE '${this.config.get(
      'TZ',
    )}' AS "dateFrom", 
    "rent_list"."dateTo" AT TIME ZONE 'GMT' AT TIME ZONE '${this.config.get(
      'TZ',
    )}' AS "dateTo" FROM car 
    INNER JOIN rent_list ON car.id = "rent_list"."carId"
    WHERE "rent_list"."dateFrom" >='${dateFrom}' AND "rent_list"."dateTo" < '${dateTo}'`;
    const currMonthEmpCars = await this.queryBuilder.runQuery(query);
    if (currMonthEmpCars) {
      const mapped = currMonthEmpCars.map(
        (car: {
          rentalId: number;
          carId: number;
          name: string;
          LP: string;
          dateFrom: Date;
          dateTo: Date;
        }) => {
          const dateTo: Date = new Date(car.dateTo);
          const dateFrom: Date = new Date(car.dateFrom);
          const dateDiff: number =
            (dateTo.valueOf() - dateFrom.valueOf()) / (24 * 60 * 60 * 1000);
          return {
            rentalId: car.rentalId,
            carId: car.carId,
            totalDays: dateDiff,
            LP: car.LP,
          };
        },
      );
      // return mapped;
      const finalArray = [];
      mapped.forEach((rental, index) => {
        const dubInd = mapped.findIndex((el) => (el.carId = rental.carId));
        if (dubInd != index) {
          const obj = {
            rentalId: rental.rentalId,
            carId: rental.carId,
            LP: rental.LP,
            daysInMonth: mapped[dubInd].totalDays + rental.totalDays,
          };
          finalArray.push(obj);
        }
      });
      return finalArray.map((el) => {
        const obj = {
          ...el,
          daysPercentInMonth: (el.daysInMonth / daysInMonth) * 100,
        };
        return obj;
      });
    }
  }
}

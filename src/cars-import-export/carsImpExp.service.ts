import * as path from 'path';
import { createWriteStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { QueryBuilder } from '@classes/queryBuilder';
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CarsImpExpService {
  redis: any;
  filePrefix: string;
  fileFolder: string;
  constructor(
    private queryBuilder: QueryBuilder,
    private config: ConfigService,
  ) {
    this.redis = new Redis({
      port: this.config.get('REDIS_PORT'),
      host: this.config.get('DB_HOST'),
    });
    this.filePrefix = 'cars-list';
    this.fileFolder = 'uploads';
  }

  public async writeCarsToDbByChunks(data: string[]) {
    const insertQuery = [];
    for (const carRow of data) {
      const [name, LP] = carRow;
      insertQuery.push(`('${name}', '${LP}')`);
    }
    insertQuery.join(',');
    const query = `INSERT INTO car ("name", "LP") VALUES ${insertQuery}`;
    await this.queryBuilder.runQuery(query);
  }

  public async exportAndGetStatus() {
    const genKey = `${this.filePrefix}-${uuidv4()}`;
    const limit = 100;
    const writableStream = createWriteStream(
      `${this.fileFolder}/${genKey}.csv`,
    );
    const countQuery = `SELECT COUNT (*) FROM car`;
    const [{ count }] = await this.queryBuilder.runQuery(countQuery);
    await this.redis.set(genKey, `0/${count}`);
    for (let i = 0; i < count; i += limit) {
      const query = `SELECT * FROM car ORDER BY ID ASC OFFSET ${i} LIMIT ${limit} `;
      const rows = await this.queryBuilder.runQuery(query);
      for (const row of rows) {
        const { name, LP } = row;
        writableStream.write(`${name}, ${LP}`);
        writableStream.write(`\n`);
      }
      await this.redis.set(genKey, `${i}/${count}`);
    }
    await this.redis.set(genKey, `done`);
    writableStream.end();
    return { fileWriteSession: genKey };
  }

  public async getExportedListFile(session: string) {
    const fileStatus = await this.redis.get(session);
    const absolutePath = path.resolve(`${this.fileFolder}/${session}.csv`);

    if (!fileStatus)
      return {
        status: 404,
        msg: `${absolutePath} doesn't exist`,
      };
    if (fileStatus === 'done') return { status: 200, fileLink: absolutePath };
    return { fileStatus };
  }
}

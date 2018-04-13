import * as _ from 'lodash';
import { assert } from 'chai';

import {
  TClass,
  IInstance,
} from 'ancient-mixins/lib/mixins';

import {
  Node,
  INode,
  INodeEventsList,
} from 'ancient-mixins/lib/node';

export interface ITrackingTriggersEventsList extends INodeEventsList {
}

export type TTrackingTriggers = ITrackingTriggers<ITrackingTriggersEventsList>;
export interface ITrackingTriggers<IEL extends ITrackingTriggersEventsList>
extends INode<IEL> {
  trackingsTableName: string;
  insertUpdateFunctionName: string;
  truncateFunctionName: string;

  createTrackingsTable(): string;

  createFunctionInsertUpdate(): string;
  createFunctionDelete(): string;
  createFunctions(): string;

  createTriggerInsertUpdate(tableName: string): string;
  createTriggerDelete(tableName: string): string;
  createTriggers(tableName: string): string;

  dropFunction(functionName): string;
  dropTrigger(tableName, triggerName): string;
  dropTable(tableName): string;
}

export function mixin<T extends TClass<IInstance>>(
  superClass: T,
): any {
  return class TrackingTriggers extends superClass {
    public trackingsTableName = `ancient_postgresql_trackings`;
    public insertUpdateFunctionName = `ancient_postgresql_insert_update_live`;
    public deleteFunctionName = `ancient_postgresql_delete_live`;
    public truncateFunctionName = `ancient_postgresql_truncate_live`;

    initTrackings() {
      return `create table if not exists ${this.trackingsTableName} (
        id serial primary key,
        fetchQuery text,
        liveQuery text,
        tracked text,
        channel text
      );`;
    }

    createFunctionTrackings() {
      return `
      CREATE or REPLACE function ${this.trackingsTableName}_func() RETURNS trigger as $trigger$
        DECLARE
          tracked TEXT;
        BEGIN
          EXECUTE $exec$ 
            SELECT $$'$$ || string_agg ('"'||liveQuery.id|| '/' ||liveQuery.table||'"', $$', '$$) || $$'$$ 
            FROM ($exec$ || NEW.liveQuery || $exec$) as liveQuery 
          $exec$ INTO NEW.tracked;
          IF NEW.tracked IS null THEN 
            NEW.tracked := $$('')$$; 
          END IF;
        return NEW;
        END;
      $trigger$ LANGUAGE plpgsql;`;
    }

    createTriggerTrackings() {
      return `CREATE TRIGGER ${this.trackingsTableName}_${this.trackingsTableName}_func
        BEFORE INSERT OR UPDATE ON ${this.trackingsTableName}
        FOR EACH ROW
        EXECUTE PROCEDURE ${this.trackingsTableName}_func();`;
    }

    createFunctionInsertUpdate() {
      return `	
        CREATE or REPLACE function ${this.insertUpdateFunctionName}() RETURNS trigger as $trigger$
        DECLARE
          currentTracking RECORD;
          execString TEXT;
        BEGIN
          SELECT 
            string_agg ($$( 
              SELECT 
                oneTracking.channel, 
                oneTracking.queryID, 
                oneTracking.fetched 
              FROM (
                SELECT 
                  '$$ || ${this.trackingsTableName}.channel || $$' as channel, 
                  $$ || ${this.trackingsTableName}.id || $$ as queryID, 
                  fetchResults.fetched as fetched
                FROM 
                  ($$ || ${this.trackingsTableName}.liveQuery || $$) as liveResults,
                  (
                    SELECT array_agg(fetchQuery) as fetched 
                    FROM ($$ || ${this.trackingsTableName}.fetchQuery || $$) as fetchQuery
                  ) as fetchResults
                WHERE 
                  liveResults.id = '$$ || NEW.id || $$' and
                  liveResults.table = '$$ || TG_TABLE_NAME || $$'
              UNION
                SELECT 
                  '$$ || ${this.trackingsTableName}.channel || $$' as channel, 
                  $$ || ${this.trackingsTableName}.id || $$ as queryID, 
                  fetchResults.fetched as fetched
                FROM 
                  ($$ || ${this.trackingsTableName}.liveQuery || $$) as liveResults,
                  (
                    SELECT array_agg(fetchQuery) as fetched 
                    FROM ($$ || ${this.trackingsTableName}.fetchQuery || $$) as fetchQuery
                  ) as fetchResults
                WHERE 
                  '$$ || '"' || NEW.id || $$/$$ || TG_TABLE_NAME || '"' || $$' in ($$ || ${this.trackingsTableName}.tracked || $$)
              ) as oneTracking limit 1 
            )$$, 
            ' union ') INTO execString 
          FROM ${this.trackingsTableName};

          IF execString IS NOT null THEN
            for currentTracking in EXECUTE execString LOOP
              IF currentTracking.fetched IS null THEN
                currentTracking.fetched := array[''];
              END IF;   
              UPDATE ${this.trackingsTableName} SET tracked = '' WHERE id = currentTracking.queryID;
              PERFORM pg_notify (
                currentTracking.channel, 
                '{ "table": "' || TG_TABLE_NAME || E'", 
                  "id": ' || NEW.id || ', 
                  "query": ' || currentTracking.queryID || ', 
                  "fetched": [' || array_to_string(currentTracking.fetched, ', ') || '], 
                  "event": "' || TG_OP || '" }');
            END loop;
          END IF;

          return NEW;
        END;
        $trigger$ LANGUAGE plpgsql;
      `;
    }
    createTriggerInsertUpdate(tableName) {
      return `CREATE TRIGGER ${tableName}_${this.insertUpdateFunctionName}
        AFTER INSERT or UPDATE ON ${tableName}
        FOR EACH ROW
        EXECUTE PROCEDURE ${this.insertUpdateFunctionName}();
      `;
    }

    createFunctionDelete() {
      return `	
        CREATE or REPLACE function ${this.deleteFunctionName}() RETURNS trigger as $trigger$
        DECLARE
          currentTracking RECORD;
          execString TEXT;
        BEGIN
          SELECT 
            string_agg ($$( 
              SELECT 
                oneTracking.channel, 
                oneTracking.queryID, 
                oneTracking.fetched 
              FROM (
                SELECT 
                  '$$ || ${this.trackingsTableName}.channel || $$' as channel, 
                  $$ || ${this.trackingsTableName}.id || $$ as queryID, 
                  fetchResults.fetched as fetched
                    FROM 
                      ($$ || ${this.trackingsTableName}.liveQuery || $$) as liveResults,
                      (
                        SELECT array_agg(fetchQuery) as fetched 
                        FROM ($$ || ${this.trackingsTableName}.fetchQuery || $$) as fetchQuery
                      ) as fetchResults
                    WHERE 
                      liveResults.id = '$$ || OLD.id || $$' and
                      liveResults.table = '$$ || TG_TABLE_NAME || $$'
              UNION
                SELECT 
                  '$$ || ${this.trackingsTableName}.channel || $$' as channel, 
                  $$ || ${this.trackingsTableName}.id || $$ as queryID, 
                  fetchResults.fetched as fetched
                FROM 
                  ($$ || ${this.trackingsTableName}.liveQuery || $$) as liveResults,
                  (
                    SELECT array_agg(fetchQuery) as fetched 
                    FROM ($$ || ${this.trackingsTableName}.fetchQuery || $$) as fetchQuery
                  ) as fetchResults
                WHERE 
                  '$$ || '"' || OLD.id || $$/$$ || TG_TABLE_NAME || '"' || $$' in ($$ || ${this.trackingsTableName}.tracked || $$)
              ) as oneTracking limit 1 
            )$$, 
            ' union ') INTO execString 
          FROM ${this.trackingsTableName};
          
          IF execString IS NOT NULL THEN
            FOR currentTracking IN EXECUTE execString LOOP
              IF currentTracking.fetched IS NULL THEN
                currentTracking.fetched := array[''];
              END IF;     
              UPDATE ${this.trackingsTableName} SET tracked = '' WHERE id = currentTracking.queryID;
              PERFORM pg_notify (
                currentTracking.channel, 
                '{ "table": "' || TG_TABLE_NAME || E'", 
                  "id": ' || OLD.id || ', 
                  "query": ' || currentTracking.queryID || ', 
                  "fetched": [' || array_to_string(currentTracking.fetched, ', ') || '], 
                  "event": "' || TG_OP || '" }');
            END LOOP;
          END IF;
          return OLD;
        END;
        $trigger$ LANGUAGE plpgsql;
      `;
    }
    createTriggerDelete(tableName) {
      return `CREATE TRIGGER ${tableName}_${this.deleteFunctionName}
        AFTER DELETE ON ${tableName}
        FOR EACH ROW
        EXECUTE PROCEDURE ${this.deleteFunctionName}();
      `;
    }
    createFunctionTruncate() {
      return `	
      CREATE or REPLACE function ${this.truncateFunctionName}() RETURNS trigger as $trigger$
      DECLARE
        currentTracking RECORD;
        execString TEXT;
        BEGIN
          SELECT string_agg($$( 
            SELECT  
              oneTracking.channel, 
              oneTracking.queryID, 
              oneTracking.fetched 
            FROM (
              SELECT 
                '$$ || ${this.trackingsTableName}.channel || $$' as channel, 
                $$ || ${this.trackingsTableName}.id || $$ as queryID, 
                fetchResults.fetched as fetched
              FROM 
                ($$ || ${this.trackingsTableName}.liveQuery || $$) as q,
                (
                  SELECT array_agg(fetchQuery) as fetched 
                  FROM ($$ || ${this.trackingsTableName}.fetchQuery || $$) as fetchQuery
                ) as fetchResults
              WHERE (q.table = '$$ || TG_TABLE_NAME || $$')
            UNION
              SELECT 
                '$$ || ${this.trackingsTableName}.channel || $$' as channel, 
                $$ || ${this.trackingsTableName}.id || $$ as queryID, 
                fetchResults.fetched as fetched
              FROM (
                SELECT $s_a$'$s_a$ || string_agg('"'||liveQuery.id||'/'||liveQuery.table||'"', $s_a$', '$s_a$) || $s_a$'$s_a$ as track 
                FROM ($$ || ${this.trackingsTableName}.liveQuery || $$) as liveQuery
              ) as liveResults,
              (
                SELECT array_agg (fetchQuery) as fetched 
                FROM ($$ || ${this.trackingsTableName}.fetchQuery || $$) as fetchQuery
              ) as fetchResults
              WHERE 
                liveResults.track is null or
                liveResults.track <> $$ || '$$' || ${this.trackingsTableName}.tracked || '$$' || $$
            ) as oneTracking limit 1
          ) $$,
        ' union ') INTO execString FROM ${this.trackingsTableName};

        IF execString IS NOT NULL THEN
          FOR currentTracking IN EXECUTE execString LOOP
            UPDATE ${this.trackingsTableName} SET tracked = '' WHERE id = currentTracking.queryID;
            IF currentTracking.fetched IS NULL THEN
              PERFORM pg_notify (currentTracking.channel, '{ "table": "' || TG_TABLE_NAME || E'", "query": ' || currentTracking.queryID || ', "fetched": [], "event": "' || TG_OP || '"}' );
            ELSE
              PERFORM pg_notify (
                currentTracking.channel, 
                '{ "table": "' || TG_TABLE_NAME || E'", 
                "query": ' || currentTracking.queryID || ', 
                "fetched": [' || array_to_string(currentTracking.fetched, ', ') || '], 
                "event": "' || TG_OP || '" }');
            END IF;
          END LOOP;
        END IF;
        return OLD;
      END;
      $trigger$ LANGUAGE plpgsql;
      `;
    }
    createTriggerTruncate(tableName) {
      return `CREATE TRIGGER ${tableName}_${this.truncateFunctionName}
        AFTER TRUNCATE ON ${tableName}
        EXECUTE PROCEDURE ${this.truncateFunctionName}();
      `;
    }
    dropFunction(functionName) {
      return `DROP function IF EXISTS ${functionName} ();`;
    }
    dropTrigger(tableName, functionName) {
      return `DROP trigger IF EXISTS ${tableName}_${functionName} on ${tableName};`;
    }
    dropTable(tableName) {
      return `DROP table IF EXISTS ${tableName};`;
    }
    createFunctions() {
      return [this.createFunctionInsertUpdate(), this.createFunctionDelete(), this.createFunctionTruncate(), this.createFunctionTrackings()].join('');
    }
    createTriggers(tableName) {
      return [this.createTriggerInsertUpdate(tableName), this.createTriggerDelete(tableName), this.createTriggerTruncate(tableName)].join('');
    }
    createTrackingTrigger() {
      return [this.createTriggerTrackings()].join('');
    }
    dropTriggers(tableName) {
      return [this.dropTrigger(tableName, this.insertUpdateFunctionName), this.dropTrigger(tableName, this.deleteFunctionName), this.dropTrigger(tableName, this.truncateFunctionName)].join('');
    }
    dropFunctions() {
      return [this.dropFunction(this.insertUpdateFunctionName), this.dropFunction(this.deleteFunctionName), this.dropFunction(this.truncateFunctionName)].join('');
    }
  };
}

export const MixedTrackingTriggers: TClass<TTrackingTriggers> = mixin(Node);
export class TrackingTriggers extends MixedTrackingTriggers {}
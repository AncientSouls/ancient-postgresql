"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
require('source-map-support').install();
const query_1 = require("./query");
const live_query_1 = require("./live-query");
const live_triggers_1 = require("./live-triggers");
describe('AncientSouls/PostgreSQL:', () => {
    if (!process.env.DEVELOP) {
        it('wait pg docker', (done) => {
            setTimeout(() => done(), 4000);
        });
    }
    query_1.default();
    live_query_1.default();
    live_triggers_1.default();
});
//# sourceMappingURL=index.js.map
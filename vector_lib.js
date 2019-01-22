if (typeof window === 'undefined') {
    // Running in Node.js.

}
else {
    // Running in browser.
    var module = { }; // Prevent browser exception when exporting as module.
}

// Polyfills
if (!String.prototype.padStart) {
    String.prototype.padStart = function padStart(targetLength,padString) {
        targetLength = targetLength>>0; 
        padString = String((typeof padString !== 'undefined' ? padString : ' '));
        if (this.length > targetLength) {
            return String(this);
        }
        else {
            targetLength = targetLength-this.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength/padString.length); 
            }
            return padString.slice(0,targetLength) + String(this);
        }
    };
}

if (!Array.isArray) {
    Array.isArray = function(arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
    };
}

Vector = function(data) {
    this.vectorType = true;
    this.data = data === undefined ? [] : formatData(data);
    this.length = data === undefined ? 0 : data.length;

    this.get = function(index) {
        return this.data[index];
    }

    this.refper = function(index) {
        return this.data[index].refper;
    }

    this.refperStr = function(index) {
        return datestring(this.refper(index));
    }

    this.value = function(index) {
        return this.data[index].value;
    }

    this.push = function(datapoint) {
        this.data.push(formatPoint(datapoint));
        this.length++;
    }

    this.equals = function(other, index) {
        let pointEquals = function(a, b) {
            return a.refper.getTime() == b.refper.getTime() 
                    && a.value == b.value;
        }

        if (index !== undefined) {
            return pointEquals(this.get(index), other.get(index));
        }

        if (this.length != other.length) {
            return false;
        } 
        for (let p = 0; p < this.length; p++) {
            if (!pointEquals(this.get(p), other.get(p))) return false;
        }      
        return true;
    }

    this.copy = function() {
        let copy = new Vector();
        for (let p = 0; p < this.length; p++) {
            let copyPoint = {'refper': this.refper(p), 'value': this.value(p)};
            safeMerge(copyPoint, this.get(p));
            copy.push(copyPoint);
        }
        return copy;
    }

    this.filter = function(predicate) {
        let result = new Vector();
        for (let p = 0; p < this.length; p++) {
            if (predicate(this.get(p))) result.push(this.get(p));
        } 
        return result;
    }

    this.range = function(startDate, endDate) {
        startDate = formatDateObject(startDate);
        endDate = formatDateObject(endDate);
        let rangeFilter = function(point) {
            return point.refper >= startDate && point.refper <= endDate;
        };
        return this.filter(rangeFilter);
    }

    this.latestN = function(n) {
        if (n > this.length) throw new Error("N > length of vector.");
        let result = new Vector();
        for (let p = this.length - n; p < this.length; p++) {
            result.push(this.get(p));
        }
        return result;
    }

    this.interoperable = function(other) {
        if (this.length != other.length) return false;
        for (let p = 0; p < this.length; p++) {
            if (this.refper(p).getTime() != other.refper(p).getTime()) {
                return false;
            }
        }   
        return true;  
    }

    this.intersection = function(other) {
        let result = new Vector();

        let pThis = 0;
        let pOther = 0;
        while (pThis < this.length) {
            while (pOther < other.length) {
                let thisRefper = this.refper(pThis);
                let otherRefper = other.refper(pOther);
                if (thisRefper.getTime() == otherRefper.getTime()) {
                    result.push(this.get(pThis));
                    pOther++;
                }
                else if (thisRefper > otherRefper) {
                    pOther++;
                }
                else {
                    break;
                }
            }
            pThis++;
        }

        return result;
    }

    this.periodDeltaTransformation = function(operation) {
        let result = new Vector();

        for (let p = 0; p < this.length; p++) {
            let value = null;
            if (this.get(p-1) != undefined) {
                let lastVal = this.value(p - 1);
                let currVal =  this.value(p);
                value = operation(currVal, lastVal);
            }
            let point = {'refper': this.refper(p), 'value': value};
            safeMerge(point, this.get(p));
            result.push(point)
        }

        return result;
    }

    this.periodTransformation = function(operation) {
        let result = new Vector();   
        for (let p = 0; p < this.length; p++) {
            let point = this.get(p);
            let newPoint = {
                'refper': point.refper,
                'value': operation(point.value)
            };
            safeMerge(newPoint, point);
            result.push(newPoint);
        }
        return result;
    }

    this.periodToPeriodPercentageChange = function() {
        return this.periodDeltaTransformation(function(curr, last) {
            return (curr-last) / Math.abs(last) * 100;
        });
    }

    this.periodToPeriodDifference = function() {
        return this.periodDeltaTransformation(function(curr, last) {
            return curr - last;
        });
    }

    this.samePeriodPreviousYearPercentageChange = function() {
        return this.annualize().periodToPeriodPercentageChange();
    };

    this.samePeriodPreviousYearDifference = function() {
        return this.annualize().periodToPeriodDifference();
    };

    this.annualize = function() {
        if (this.length == 0) return this;
        
        let result = new Vector();
        let currPoint = this.get(0);
        let currYear = this.refper(0).getUTCFullYear();
        for (let p = 1; p < this.length; p++) {
            let nextYear = this.refper(p).getUTCFullYear();
            if (nextYear != currYear) {
                result.push(currPoint);
            }
            currPoint = this.get(p);
            currYear = nextYear;
        }
        result.push(this.get(this.length - 1));
        return result.filter(function(point) {
            return point.refper.getUTCMonth() == result.refper(0).getUTCMonth();
        });
    }

    this.round = function(decimals) {
        let result = new Vector();
        for (let p = 0; p < this.length; p++) {
            let point = this.get(p);
            let newPoint = {
                'refper': point.refper,
                'value': scalarRound(point.value, decimals)
            };
            safeMerge(newPoint, point);
            result.push(newPoint);
        }
        return result;
    };

    this.roundBankers = function(decimals) {
        let result = new Vector();
        for (let p = 0; p < this.length; p++) {
            let point = this.get(p);
            let newPoint = {
                'refper': point.refper,
                'value': scalarRoundBankers(point.value, decimals)
            };
            safeMerge(newPoint, point);
            result.push(newPoint);
        }
        return result;
    }

    function scalarRound(value, decimals) {
        decimals = decimals || 0;
        return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
    }

    function scalarRoundBankers(value, decimals) {
        decimals = decimals || 0;
        let x = value * Math.pow(10, decimals);
        let r = Math.round(x);
        let br = Math.abs(x) % 1 === 0.5 ? (r % 2 === 0 ? r : r-1) : r;
        return br / Math.pow(10, decimals);
    }

    function formatData(data) {
        for (let p = 0; p < data.length; p++) {
            formatPoint(data[p]);
        }
        return data;
    }

    function formatPoint(datapoint) {
        datapoint.refper = formatDateObject(datapoint.refper);
        return datapoint;
    }
}

VectorLib = function() {
    operators = {
        '+': function(a, b) { return a + b; },
        '-': function(a, b) { return a - b; },
        '*': function(a, b) { return a * b; },
        '/': function(a, b) { return a / b; }
    };
    
    operatorPriorities = {
        '*': 2,
        '/': 2,
        '+': 1,
        '-': 1,
    };

    this.formatDateObject = function(vector) {
        for (let p = 0; p < vector.length; p++) {
            vector[p].refper = formatDateObject(vector[p].refper);
        }
        return vector;
    };

    this.formatDateString = function(vector) {
        for (let p = 0; p < vector.length; p++) {
            vector[p].refper = formatDateString(vector[p].refper);
        }
        return vector;
    };

    this.intersection = function(vectors) {
        if (Array.isArray(vectors)) {
            return arrayIntersection(vectors);
        } 
        else {
            // Handle dictionary of ID -> Vector.
            let ids = [];
            let vectorArray = [];
            for (let vectorId in vectors) {
                ids.push(vectorId);
                vectorArray.push(vectors[vectorId]);
            }

            let intersect = arrayIntersection(vectorArray);
            let result = {};
            for (let v = 0; v < intersect.length; v++) {
                result[ids[v]] = intersect[v];
            }

            return result;
        }
    }

    function arrayIntersection(vectors) {
        let flatVectors = {};
        
        for (let v = 0; v < vectors.length; v++) {
            let vector = vectors[v];
            
            for (let p = 0; p < vector.length; p++) {
                let refper = vector[p].refper;
                if (!(refper in flatVectors)) {
                    flatVectors[refper] = [];
                }
                flatVectors[refper].push(vector[p]);
            }
        }
        
        // Get max vector for iterating
        let intersection = [];
        
        let maxV = 0;
        let maxL = vectors[0].length;
        for (let v = 0; v < vectors.length; v++) {
            if (vectors[v].length > maxL) {
                maxV = v;
                maxL = vectors[v].length;
            }
            
            intersection.push([]);
        }
        maxV = vectors[maxV];
        
        for (let p = 0; p < maxV.length; p++) {
            let point = maxV[p];
            if (!(point.refper in flatVectors)) continue;
            if (flatVectors[point.refper].length == vectors.length) {
                let flatPoint = flatVectors[point.refper];
                for (let f = 0; f < flatPoint.length; f++) {
                    intersection[f].push(flatPoint[f]);
                }
            }
        }		
        
        return intersection;
    }
 
    this.getVectorIds = function(expression) {
        expression = expression.replace(/ /g, '');
        let ids = [];	
        let nextId = "";
        for (let c = 0; c < expression.length; c++) {
            if (expression[c] == 'v' && !isNaN(expression[c + 1])) {
                nextId = "v";
            }
            else if (nextId != "" && !isNaN(expression[c])) {
                nextId += expression[c];
            } else {
                if (nextId != "") ids.push(nextId.substring(1));
                nextId = "";
            }
        }
        
        if (nextId != "") ids.push(nextId.substring(1));
        return ids;
    }
    
    
    this.evaluate = function(expression, vectors) {
        // {'v1': {'refper': "2018-01-01", 'value': 1}, ...}
        expression = expression.replace(/ /g, '')
    
        let infix = splitSymbols(expression);
        let post = postfix(infix);
            
        let stack = [];
        
        for (let s = 0; s < post.length; s++) {
            let symbol = post[s];
            
            if (typeof symbol === 'string' && symbol[0] == 'v') {
                stack.push(new ExpressionNode(vectors[symbol]));			
            }
            else if (!isNaN(symbol)) {
                stack.push(new ExpressionNode(symbol));
            }
            else {
                let s1 = stack.pop();
                let s2 = stack.pop();
                
                let node = new ExpressionNode(operators[symbol]);
                node.left = s1;
                node.right = s2;
                
                stack.push(node);
            }
        }
        
        return stack.pop().result();
    };
    
    
    ExpressionNode = function(value) {
        this.operation = null;
        this.value = null;  
        this.left = null;
        this.right = null;
        
        if (value.vectorType || !isNaN(value)) {
            this.value = value;
        }
        else {
            this.operation = value;
        }
        
        
        /**
         * Returns a value based on the operation of this node.
        **/
        this.result = function() {
            if (this.isVector() || this.isScalar()) {
                return this.value;
            }  
            else {
                if (this.left == null || this.right == null) {
                    throw new Error('Could not evaluate operator node.'); 
                }
            
                return operate(
                        this.right.result(), 
                        this.left.result(), 
                        this.operation);
            } 
        }
        
        this.hasChildren = function() {
            return !(this.left == null && this.right == null);
        }
        
        this.isOperator = function() {
            return this.operation != null;
        }

        this.isVector = function() {
            return this.operation == null && this.value.vectorType;
        }
        
        this.isScalar = function() {
            return this.operation == null && !isNaN(this.value);
        }
    };
    
    
    /**
     * Returns a vector based on an operation 
     *
     * operation: Function to apply to vector values. 
    **/
    operate = function(valueA, valueB, operation) {
        if (valueA.vectorType && valueB.vectorType) {
            return vectorOperate(valueA, valueB, operation);
        }
        if (valueA.vectorType && !isNaN(valueB)) {
            return vectorScalarOperate(valueA, valueB, operation);
        }	
        if (!isNaN(valueA) && valueB.vectorType) {
            return vectorScalarOperate(valueB, valueA, operation);
        }
        if (!isNaN(valueA) && !isNaN(valueB)) {
            return operation(valueA, valueB);
        }
        
        throw new Error("Unsupported types for operation.");
    };


    vectorScalarOperate = function(vector, scalar, operation) {
        let result = new Vector();     
        for (let p = 0; p < vector.length; p++) {
            let newPoint = {
                'refper': vector.refper(p),
                'value': operation(vector.value(p), scalar)
            };  
            // Merge keys added by the user.
            safeMerge(newPoint, vector.get(p));     
            result.push(newPoint);
        }       
        return result;
    };


    vectorOperate = function(vectorA, vectorB, operation) {
        // Intersect vectors before operating.
        vectorA = vectorA.intersection(vectorB);
        vectorB = vectorB.intersection(vectorA);

        let result = new Vector();
        
        for (let p = 0; p < vectorA.length; p++) {
            let refperA = vectorA.refper(p);
            let refperB = vectorB.refper(p);

            let newPoint =  {
                'refper': vectorA.refper(p), 
                'value': operation(vectorA.value(p), vectorB.value(p))
            };
            
            // Merge keys added by the user.
            safeMerge(newPoint, vectorA.get(p));
            
            result.push(newPoint);
        }
        
        return result;
    };


    postfix = function(symbols) {
        let stack = ['('];
        let post = [];
        symbols.push(')');
        
        for (let s = 0; s < symbols.length; s++) {
            let symbol = symbols[s];
            
            if (!isNaN(symbol)) {
                post.push(symbol);
            }
            else if (symbol[0] == 'v') {
                post.push(symbol);
            }
            else if (symbol == '(') {		
                stack.push('(');
            }	
            else if (symbol == ')') {
                while (stack[stack.length - 1] != '(') {
                    post.push(stack.pop());
                }
                stack.pop();
            } 	
            else {
                while(priority(symbol) <= priority(stack[stack.length - 1])) {
                    post.push(stack.pop());
                }
            
                stack.push(symbol);
            }
        }
        
        return post;
    };


    priority = function(symbol) {
        if (symbol in operatorPriorities) {
            return operatorPriorities[symbol];
        }
        
        return 0;
    };


    splitSymbols = function(vexp) {
        let split = [];
        
        for (let pos = 0; pos < vexp.length; pos++) {
            let next = null;
            
            if (vexp[pos] == 'v' || vexp[pos] == 'V') {
                next = readVector(vexp, pos);
            }
            else if (!isNaN(vexp[pos]) 
                    || (vexp[pos] == '-' && isNaN(vexp[pos - 1]) && !isNaN(vexp[pos + 1]))) {
                next = readScalar(vexp, pos);
            }
            else if (vexp[pos] in operators) {
                next = readOperator(vexp, pos);
            }
            else if (vexp[pos] == '(' || vexp[pos] == ')') {
                next = readBracket(vexp, pos);
            }
            else {
                throw new Error(
                        "Unrecognized symbol at position " + pos + ".");
            }
            
            split.push(next.symbol);
            pos = next.pos;
        }

        return split;
    };


    readVector = function(vexp, pos) {
        let symbol = "v";
        pos++;
        
        while(!isNaN(vexp[pos]) && pos < vexp.length) {
            symbol += vexp[pos];
            pos++;		
        }

        return {'symbol': symbol, 'pos': pos - 1};
    };


    readOperator = function(vexp, pos) {
        return {'symbol': vexp[pos], 'pos': pos};
    };


    readScalar = function(vexp, pos) {
        let symbol = "";
        let start = pos;
        
        while ((!isNaN(vexp[pos]) || vexp[pos] == '.' 
                || (vexp[pos] == '-' && pos == start)) 
                && pos < vexp.length) {
            symbol += vexp[pos];	
            pos++;
        }
        
        return {'symbol': Number(symbol), 'pos': pos - 1};
    };


    readBracket = function(vexp, pos) {
        return {'symbol': vexp[pos], 'pos': pos};
    };

    
    validateBrackets = function(vexp) {
        // TODO: Expand on this to also return position of incorrect bracket.
        let stack = [];
        
        for (let c = 0; c < vexp.length; c++) {
            if (vexp[c] == '(') {
                stack.push(1);
            }
            if (vexp[c] == ')') {
                if (stack.length == 0) return false;
                stack.pop();
            }
        }

        return stack.length == 0;
    };
    
    
    // Merge but don't overwrite existing keys.
    safeMerge = function(target, source) {
        for (key in source) {
            if (!(key in target)) {
                target[key] = source[key];
            }
        }
    }

    formatDateObject = function(date) {
        if (typeof date === 'string') return stringToDate(date);
        return date;
    }

    formatDateString = function(date) {
        if (typeof date === 'string') return date;
        return datestring(date);
    }

    stringToDate = function(datestring) {
        let split = datestring.split('-');
        return realDate(
                split[0], unpad(split[1], "0"), Number(unpad(split[2], "0")));
    }
    
    datestring = function(date) {
        return date.getUTCFullYear() + "-"
                + (date.getUTCMonth() + 1).toString().padStart(2, "0") + "-"
                + date.getUTCDate().toString().padStart(2, "0");
    }   
    
    realDate = function(year, month, day) {
        return new Date(Date.UTC(year, month - 1, day));
    }
    this.realDate = realDate;

    function unpad(str, chr) {
        let start = 0;
        for (let c = 0; c < str.length; c++) {
            if (str[c] != chr) break;
            start++;
        }
        return str.substring(start);
    }  
}

module.exports = VectorLib;
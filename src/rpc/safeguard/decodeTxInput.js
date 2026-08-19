import { web3 } from "../../main.js";

export function decodeTxInput(data, abi = []) {
    const selector = data.slice(0, 10);
    const argsData = data.slice(10);

    const functions = abi.filter(m => m.type === "function") ?? [];
    const method = functions.find(m => web3.eth.abi.encodeFunctionSignature(m) === selector) ?? null;    
    const args = (method) ? web3.eth.abi.decodeParameters(method.inputs.map(i => i.type), argsData) : {};

    const decodedArgs = {};
    method?.inputs?.forEach((input, i) => {
        const val = args[i];
        decodedArgs[input.name || i] = typeof val === "bigint" ? val.toString() : val?.toString?.() || val;
    });

    return { selector, argsData, method, decodedArgs }
}

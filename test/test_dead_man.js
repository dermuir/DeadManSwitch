const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {Enigma, utils, eeConstants} = require('enigma-js/node');

//Codigo de verificacion de enigma
var EnigmaContract;
if(typeof process.env.SGX_MODE === 'undefined' || (process.env.SGX_MODE != 'SW' && process.env.SGX_MODE != 'HW' )) {
    console.log(`Error reading ".env" file, aborting....`);
    process.exit();
} else if (process.env.SGX_MODE == 'SW') {
  EnigmaContract = require('../build/enigma_contracts/EnigmaSimulation.json');
} else {
  EnigmaContract = require('../build/enigma_contracts/Enigma.json');
}
const EnigmaTokenContract = require('../build/enigma_contracts/EnigmaToken.json');


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let enigma = null;
let contractAddr;

contract("Dead_Man", accounts => {
  before(function() {
    enigma = new Enigma(
      web3,
      EnigmaContract.networks['4447'].address,
      EnigmaTokenContract.networks['4447'].address,
      'http://localhost:3346',
      {
        gas: 4712388,
        gasPrice: 100000000000,
        from: accounts[0],
      },
    );
    enigma.admin();
    contractAddr = fs.readFileSync('test/dead_man.txt', 'utf-8');
  });

  let task;

  //Viendo el Owner del proyecto
  it('Buscando el propietario', async () => {
    const taskFn = 'ver_propietario(address)';
    const taskArgs = [
      [accounts[0],'address']
    ];
    const taskGasLimit = 10000000;
    const taskGasPx = utils.toGrains(1e-7);
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], contractAddr)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
          .on(eeConstants.ERROR, (error) => reject(error));
    });
    task = await enigma.getTaskRecordStatus(task);
    expect(task.ethStatus).to.equal(1);
  });
  it('transaccion confirmada', async () => {
    do {
      await sleep(1000);
      task = await enigma.getTaskRecordStatus(task);
      process.stdout.write('Esperando el estado es '+task.ethStatus+'\r');
    } while (task.ethStatus === 1);
    expect(task.ethStatus).to.equal(2);
    process.stdout.write('Completado el estado es '+task.ethStatus+'\n');
  }, 10000);
  it('Verificando salida', async () => {
    task = await new Promise((resolve, reject) => {
      enigma.getTaskResult(task)
        .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error));
    });
    expect(task.engStatus).to.equal('SUCCESS');
    task = await enigma.decryptTaskResult(task);
    expect(web3.eth.abi.decodeParameters([{
        type: 'address',
        name: 'owner',
    }], task.decryptedOutput).owner).to.equal(accounts[0]);
  });


   //Confirmando el estado del contrato que sea no compartido
   it('Viendo Compartir', async () => {
    let taskFn = 'ver_compartir(address)';
    let taskArgs = [
      [accounts[0],'address']
    ];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], contractAddr)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
          .on(eeConstants.ERROR, (error) => reject(error));
    });
  });
  it('Verificando transaccion' , async()=>{
    task = await enigma.getTaskRecordStatus(task);
    expect(task.ethStatus).to.equal(1);
  });
  it('transaccion confirmada', async () => {
    do {
      await sleep(1000);
      task = await enigma.getTaskRecordStatus(task);
      process.stdout.write('Esperando el estado es '+task.ethStatus+'\r');
    } while (task.ethStatus === 1);
    expect(task.ethStatus).to.equal(2);
    process.stdout.write('Completado el estado es '+task.ethStatus+'\n');
  }, 10000);
  it('Verificando salida', async () => {
    task = await new Promise((resolve, reject) => {
      enigma.getTaskResult(task)
        .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error));
    });
    expect(task.engStatus).to.equal('SUCCESS');
    task = await enigma.decryptTaskResult(task);
    expect(web3.eth.abi.decodeParameters([{
        type: 'bool',
        name: 'compartir',
    }], task.decryptedOutput).compartir).to.equal(false);
  });



  //Viendo el secreto que debe ser fallido 
  it('Viendo secreto V1', async () => {
    let taskFn = 'ver_secreto(address)';
    let taskArgs = [[accounts[0],'address']];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], contractAddr)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
          .on(eeConstants.ERROR, (error) => reject(error));
    });
    task = await enigma.getTaskRecordStatus(task);
    expect(task.ethStatus).to.equal(1);
  });
  //Se espera que sea incorrecto
  it('transaccion confirmada', async () => {
    do {
      await sleep(1000);
      task = await enigma.getTaskRecordStatus(task);
      process.stdout.write('Esperando el estado es '+task.ethStatus+'\r');
    } while (task.ethStatus === 1);
    expect(task.ethStatus).to.equal(3);
    process.stdout.write('Completado el estado es '+task.ethStatus+'\n');
  }, 10000);



  const times = new Date();
  //Haciendo checkin V1
  it('Haciendo un check in V1 Exitoso', async () => {
    let taskFn = 'check_in(address,uint256)';
    let taskArgs = [
      [accounts[0],'address'],
      [times.getTime(),'uint256']
    ];
    let taskGasLimit = 10000000;
    let taskGasPx = utils.toGrains(1);
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], contractAddr)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
          .on(eeConstants.ERROR, (error) => reject(error));
    });
    task = await enigma.getTaskRecordStatus(task);
    expect(task.ethStatus).to.equal(1);
  });
  it('transaccion confirmada', async () => {
    do {
      await sleep(1000);
      task = await enigma.getTaskRecordStatus(task);
      process.stdout.write('Esperando el estado es '+task.ethStatus+'\r');
    } while (task.ethStatus === 1);
    expect(task.ethStatus).to.equal(2);
    process.stdout.write('Completado el estado es '+task.ethStatus+'\n');
  }, 10000);
  it('Verificando salida', async () => {
    task = await new Promise((resolve, reject) => {
      enigma.getTaskResult(task)
        .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error));
    });
    expect(task.engStatus).to.equal('SUCCESS');
    task = await enigma.decryptTaskResult(task);
    expect(web3.eth.abi.decodeParameters([{
        type: 'string',
        name: 'salida',
    }], task.decryptedOutput).salida).to.equal('Se ha realizado un check-in con exito');
  });

  
  //Publicando el secreto (Compartir a true)
  it('Publicando secreto', async () => {
    await sleep(1000);
    let taskFn = 'publicar_secreto(address)';
    let taskArgs = [[accounts[0],'address']];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], contractAddr)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
          .on(eeConstants.ERROR, (error) => reject(error));
    });
    task = await enigma.getTaskRecordStatus(task);
    expect(task.ethStatus).to.equal(1);
  });
  it('transaccion confirmada', async () => {
    do {
      await sleep(1000);
      task = await enigma.getTaskRecordStatus(task);
      process.stdout.write('Esperando el estado es '+task.ethStatus+'\r');
    } while (task.ethStatus === 1);
    expect(task.ethStatus).to.equal(2);
    process.stdout.write('Completado el estado es '+task.ethStatus+'\n');
  }, 10000);


  //Viendo el secreto compartido por parte del owner
  it('Viendo secreto V2', async () => {
    let taskFn = 'ver_secreto(address)';
    let taskArgs = [[accounts[0], 'address']];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], contractAddr)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
          .on(eeConstants.ERROR, (error) => reject(error));
    });
  });

  it('tarea pendiente', async () => {
    task = await enigma.getTaskRecordStatus(task);
    expect(task.ethStatus).to.equal(1);
  });
  
  it('transaccion confirmada', async () => {
    do {
      await sleep(1000);
      task = await enigma.getTaskRecordStatus(task);
      process.stdout.write('Esperando el estado es '+task.ethStatus+'\r');
    } while (task.ethStatus === 1);
    expect(task.ethStatus).to.equal(2);
    process.stdout.write('Completado el estado es '+task.ethStatus+'\n');
  }, 10000);

  it('Verificando salida', async () => {
    task = await new Promise((resolve, reject) => {
      enigma.getTaskResult(task)
        .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error));
    });
    expect(task.engStatus).to.equal('SUCCESS');
    task = await enigma.decryptTaskResult(task);
    expect(web3.eth.abi.decodeParameters([{
        type: 'string',
        name: 'secret',
    }], task.decryptedOutput).secret).to.equal("El veneno que vamos a dar a Kuzco");
  });
  
  //Variable que guarda el tiempo del checkin
  const  time = new Date();
  //Haciendo checkin V2 
  it('Haciendo un check in V2 Fallido', async () => {
    let taskFn = 'check_in(address,uint256)';
    let taskArgs = [
      [accounts[0] , 'address'],
      [time.getTime(),'uint256']
    ];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], contractAddr)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
          .on(eeConstants.ERROR, (error) => reject(error));
    });
  });
  it('tarea pendiente', async () => {
    task = await enigma.getTaskRecordStatus(task);
    expect(task.ethStatus).to.equal(1);
  });
  it('transaccion confirmada', async () => {
    do {
      await sleep(1000);
      task = await enigma.getTaskRecordStatus(task);
      process.stdout.write('Esperando el estado es '+task.ethStatus+'\r');
    } while (task.ethStatus === 1);
    expect(task.ethStatus).to.equal(3);
    process.stdout.write('Completado el estado es '+task.ethStatus+'\n');
  }, 10000);
  

  //Viendo el ultimo checkin
  it('Viendo el ultimo check in', async () => {
    let taskFn = 'ver_check_in(address,uint256)';
    let taskArgs = [
      [accounts[0],'address'],
      [1755972574,'uint256']
    ];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], contractAddr)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
          .on(eeConstants.ERROR, (error) => reject(error));
    });
  });
  it('tarea pendiente', async () => {
    task = await enigma.getTaskRecordStatus(task);
    expect(task.ethStatus).to.equal(1);
  });
  it('transaccion confirmada', async () => {
    do {
      await sleep(1000);
      task = await enigma.getTaskRecordStatus(task);
      process.stdout.write('Esperando el estado es '+task.ethStatus+'\r');
    } while (task.ethStatus === 1);
    expect(task.ethStatus).to.equal(2);
    process.stdout.write('Completado el estado es '+task.ethStatus+'\n');
  }, 10000);
  it('Verificando salida', async () => {
    task = await new Promise((resolve, reject) => {
      enigma.getTaskResult(task)
        .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error));
    });
    expect(task.engStatus).to.equal('SUCCESS');
    task = await enigma.decryptTaskResult(task);
    expect(web3.eth.abi.decodeParameters([{
        type: 'uint256',
        name: 'time',
    }], task.decryptedOutput).time)==time.getTime();
  });
  
  
  //Viendo dias para publicar
  it('Viendo dias para publicar', async () => {
    let taskFn = 'ver_dias(address)';
    let taskArgs = [[accounts[0],'address']];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], contractAddr)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
          .on(eeConstants.ERROR, (error) => reject(error));
    });
    task = await enigma.getTaskRecordStatus(task);
    expect(task.ethStatus).to.equal(1);

  });
  it('transaccion confirmada', async () => {
    do {
      await sleep(1000);
      task = await enigma.getTaskRecordStatus(task);
      process.stdout.write('Esperando el estado es '+task.ethStatus+'\r');
    } while (task.ethStatus === 1);
    expect(task.ethStatus).to.equal(2);
    process.stdout.write('Completado el estado es '+task.ethStatus+'\n');
  }, 10000);
  it('Verificando salida', async () => {
    task = await new Promise((resolve, reject) => {
      enigma.getTaskResult(task)
        .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error));
    });
    expect(task.engStatus).to.equal('SUCCESS');
    task = await enigma.decryptTaskResult(task);
    expect(web3.eth.abi.decodeParameters([{
        type: 'uint256',
        name: 'dias',
    }], task.decryptedOutput).dias).to.equal('2');
  });


   
  //Agregando Watcher
  it('Agregando un watcher', async () => {
    let taskFn = 'agregar_watcher(address,address)';
    let taskArgs = [
      [accounts[0],'address'],
      [accounts[1],'address']
    ];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], contractAddr)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
          .on(eeConstants.ERROR, (error) => reject(error));
    });
    task = await enigma.getTaskRecordStatus(task);
    expect(task.ethStatus).to.equal(1);
  });
  it('transaccion confirmada', async () => {
    do {
      await sleep(1000);
      task = await enigma.getTaskRecordStatus(task);
      process.stdout.write('Esperando el estado es '+task.ethStatus+'\r');
    } while (task.ethStatus === 1);
    expect(task.ethStatus).to.equal(2);
    process.stdout.write('Completado el estado es '+task.ethStatus+'\n');
  }, 10000); 
});
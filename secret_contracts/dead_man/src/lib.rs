#![no_std]
#![allow(unused_attributes)]

// Importamos y usamos las librerias necesarias
extern crate eng_wasm;
extern crate eng_wasm_derive;
extern crate serde;
#[macro_use]
use eng_wasm::*;
use eng_wasm_derive::pub_interface;
use serde::{Serialize, Deserialize};
//Estado secreto donde se guarda la informacion
static SECRETOS: &str = "secretos";

#[derive(Serialize, Deserialize)]
pub struct Secreto
{
    owner: H160,
    last_check: U256,
    dias_para_publicar: U256,
    secret: String,
    compartir:  bool,
    watchers: Vec<H160>,
}

//Funciones secretas solo accesibles por el contrato
pub struct Contract;

impl Contract {
    fn get_secretos() -> Vec<Secreto> {
        read_state!(SECRETOS).unwrap_or_default()
    }
    fn get_owner(_sender: H160) -> H160{
        let search = Self::search_watcher(_sender);
        assert!(search);
        let _secretos= Self::get_secretos();
        _secretos[0].owner
    }
    fn get_compartir(_sender: H160) -> bool{
        let search = Self::search_watcher(_sender);
        assert!(search);
        let _secretos= Self::get_secretos();
        _secretos[0].compartir
    }
    fn set_check_in(_sender: H160,_timestamp: U256) -> String{
        let mut secreto = Self::get_secretos();
        assert!((secreto[0].owner==_sender), "No tienes el permiso para hacer check-in");
        //Secreto ya compartido
        assert!(!(secreto[0].compartir), "El secreto ya esta compartido");
        let mut estado;
        //Caso de check-in exitoso
        if (secreto[0].last_check + (U256::from(86400000) * secreto[0].dias_para_publicar)) > _timestamp
        {
            secreto[0].last_check=_timestamp;  
            estado = String::from("Se ha realizado un check-in con exito");
        //Caso check-in excedido
        }else {
            secreto[0].compartir=true;
            estado = String::from("Tiempo de check-in excedido... Publicando el Secreto");
        }
        write_state!(SECRETOS=> secreto);
        estado
    }
    fn get_check_in(_sender: H160,_timestamp : U256)-> U256{
        let search = Self::search_watcher(_sender);
        assert!(search);
        let secreto = Self::get_secretos();
        if (secreto[0].last_check + (U256::from(86400000) * secreto[0].dias_para_publicar)) < _timestamp{
            let mut secretos = Self::get_secretos();        
            secretos[0].compartir=true;
            write_state!(SECRETOS=> secretos);
        }
        secreto[0].last_check
    }
    fn verificar_secreto(_sender: H160) -> String{
        let secreto = Self::get_secretos();
        assert!(secreto[0].compartir, "El secreto aun no se ha compartido");
        let search = Self::search_watcher(_sender);
        assert!(search);
//        assert!((secreto[0].owner==_owner), "No tienes el permiso para ver el secreto");
        secreto[0].secret.to_string()
    }
    fn compartir_secreto(_owner: H160){
        let mut secreto= Self:: get_secretos();
        assert!(!secreto[0].compartir, "El secreto ye se compartio");
        assert!(secreto[0].owner == _owner, "No tienes el permiso para compartir el secreto");
        secreto[0].compartir = true;
        write_state!(SECRETOS => secreto);
    }
    fn get_dias(_sender: H160) -> U256{
        let search = Self::search_watcher(_sender);
        assert!(search);
        let secreto = Self::get_secretos();
        secreto[0].dias_para_publicar
    }
    fn add_watchers(_sender : H160, _address : H160){
        let mut secreto = Self::get_secretos();
        assert!(secreto[0].owner==_sender, "No tienes los permisos para agregar un watcher");
        let mut aux=false;
        for elem in secreto[0].watchers.iter_mut() {
            if elem == &_address{
                aux=true;
                break;
            }
        }
        assert!(!aux,"Usuario ya registrado");
        secreto[0].watchers.push(_address); 
        write_state!(SECRETOS => secreto);
        
    }
    fn remove_wathcers(_sender : H160, _address : H160){
        let mut secreto = Self::get_secretos();
        let mut validador = false;
        assert!(secreto[0].owner==_sender, "No tienes los permisos para agregar un watcher");
        assert!(secreto[0].owner!=_address, "No puedes eliminar la posibilidad de ver el secreto a el propietario");
        for elem in 0..secreto[0].watchers.len() {
            if secreto[0].watchers[elem] == _address{
                assert_eq!(secreto[0].watchers.remove(elem), _address);
                write_state!(SECRETOS => secreto);
                validador=true;
                break;
            }
        }   
        assert!(validador, "Address no encontrada");
        //let remAdd = secreto[0].watchers.drain_filter(|x| *x == _address).collect::<Vec<_>>();
        //write_state!(SECRETOS => secreto);
    }
    fn search_watcher(_address : H160)-> bool {
        let mut secreto = Self::get_secretos();
        let mut aux=false;
        for elem in secreto[0].watchers.iter_mut() {
            if elem == &_address{
                aux=true;
                break;
            }
        }
        aux
    }
}
//Comportamiento publico 
#[pub_interface]
pub trait ContractInterface
{   
    fn construct(secret: String, owner:  H160, last_check: U256, dias_para_publicar: U256);
    fn ver_secreto(_sender: H160) -> String;
    fn ver_propietario(_sender: H160) -> H160;
    fn ver_compartir(_sender: H160) -> bool;
    fn publicar_secreto(_sender: H160);
    fn check_in(_sender: H160, _timestamp: U256) -> String;
    fn ver_check_in(_sender: H160, _timestamp : U256) -> U256;
    fn ver_dias(_sender :H160) -> U256;
    fn agregar_watcher(_sender: H160, _address: H160);
    fn eliminar_watcher(_sender: H160, _address: H160);
}

impl ContractInterface for Contract
{
    #[no_mangle]
    fn construct(secret: String,owner:  H160, last_check: U256, dias_para_publicar: U256){
        let mut vec =  Vec::new();
        vec.push(owner);
        let secretos = Secreto{owner : owner, secret : secret, last_check: last_check, dias_para_publicar : dias_para_publicar, compartir:  false, watchers : vec};
        let mut vector : Vec<Secreto> = Vec::new();
        vector.push(secretos);
        write_state!(SECRETOS => vector);
    }    
    #[no_mangle]
    fn ver_propietario(_sender : H160) -> H160{
        Self::get_owner(_sender)
    }
    #[no_mangle]
    fn ver_secreto(_sender: H160) -> String{
        Self::verificar_secreto(_sender)
    }
    #[no_mangle]
    fn ver_compartir(_sender: H160) -> bool{
        Self::get_compartir(_sender)
    }
    #[no_mangle]
    fn publicar_secreto(_sender: H160){
        Self::compartir_secreto(_sender);
    }
    #[no_mangle]
    fn check_in(_sender : H160, _timestamp: U256) -> String{
        Self::set_check_in(_sender,_timestamp)
    }
    #[no_mangle]
    fn ver_check_in(_sender: H160,_timestamp:U256) -> U256 {
        Self::get_check_in(_sender,_timestamp)
    }
    #[no_mangle]
    fn ver_dias(_sender: H160) -> U256{
        Self::get_dias(_sender)
    }
    #[no_mangle]
    fn agregar_watcher(_sender: H160, _address: H160){
        Self::add_watchers(_sender,_address);
    }
    #[no_mangle]
    fn eliminar_watcher(_sender: H160, _address: H160){
        Self::remove_wathcers(_sender,_address);
    }
}

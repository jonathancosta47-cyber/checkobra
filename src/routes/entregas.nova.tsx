import {createFileRoute,Link} from '@tanstack/react-router';
import {useEffect,useState} from 'react';
import {DeliveryAccess} from '@/components/DeliveryAccess';
import {DeliveryForm} from '@/components/DeliveryForm';
import {newDelivery,type Delivery} from '@/lib/delivery';
import {readDelivery} from '@/lib/delivery-store';
export const Route=createFileRoute('/entregas/nova')({validateSearch:(s:Record<string,unknown>):{id?:string}=>typeof s['id']==='string'?{id:s['id']}:{},head:()=>({meta:[{title:'Preencher vistoria de entrega — CheckObra'},{name:'description',content:'Checklist por ambiente, documentação e assinaturas da entrega.'},{property:'og:title',content:'Preencher vistoria de entrega — CheckObra'},{property:'og:description',content:'Registre a vistoria técnica da unidade residencial.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Page});
function Page(){const{id}=Route.useSearch();return <main className="mx-auto max-w-3xl px-4 pb-16 pt-6"><Link to="/entregas" className="text-sm text-muted-foreground">← Entregas</Link><h1 className="my-5 text-3xl font-bold">{id?'Editar vistoria':'Nova vistoria de entrega'}</h1><DeliveryAccess><Editor id={id}/></DeliveryAccess></main>;}
function Editor({id}:{id?:string}){const[d,setD]=useState<Delivery|null>(null),[error,setError]=useState('');useEffect(()=>{if(id)readDelivery(id).then(setD).catch(()=>setError('Vistoria não encontrada ou acesso indisponível.'));else setD(newDelivery());},[id]);return error?<p role="alert">{error}</p>:d?<DeliveryForm key={d.id} initial={d}/>:<p role="status">Carregando…</p>;}

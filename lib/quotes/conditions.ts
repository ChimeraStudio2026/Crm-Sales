// Condizioni generali stampate in fondo ai preventivi Chimera (dal preventivo CS1288).
// Il punto 2 usa i termini di pagamento del preventivo.

export interface QuoteConditionClause {
  title: string;
  text: string;
}

export function buildQuoteConditions(paymentTerms: string): QuoteConditionClause[] {
  return [
    {
      title: '1. AMBITO',
      text: 'Queste condizioni generali si applicano a tutti gli obblighi derivanti o che possono derivare dal preventivo al quale sono allegate e a tutti i preventivi additivi a questo preventivo, nonché, più in generale, a qualsiasi servizio fornito o vendita direttamente o indirettamente connessa all\'oggetto di tali preventivi. Il termine Produttore si riferisce all\'emittente del preventivo. Il termine Azienda si riferisce al destinatario del preventivo. Queste condizioni generali, il preventivo a cui sono allegate e tutti i preventivi additivi costituiscono insieme il contratto tra il Produttore e l\'Azienda.',
    },
    { title: '2. TERMINI DI PAGAMENTO', text: paymentTerms || 'DA DEFINIRE' },
    {
      title: '3. PRICES',
      text: 'a) Il prezzo indicato nel preventivo copre, salvo indicazione contraria, i servizi descritti, escludendo quelli esplicitamente esclusi o non specificatamente inclusi nel preventivo. b) Questo prezzo può essere soggetto a revisione in base a riunioni di pre-produzione e modifiche a sinossi, sceneggiature, storyboard, tagli di scene o calendari successivi all\'emissione del preventivo. c) Ogni revisione sarà rappresentata da un nuovo preventivo complessivo o da uno o più preventivi additivi. In assenza di accettazione di tali preventivi, il Produttore sarà vincolato solo dagli obblighi del preventivo originale.',
    },
    {
      title: '4. ADDITIONAL COSTS',
      text: 'a) Se l\'Azienda richiede modifiche o lavori aggiuntivi dopo l\'ultima riunione di pre-produzione o la ripresa di lavori accettati, i costi aggiuntivi, compreso il margine, saranno a carico dell\'Azienda, salvo risparmi compensativi derivanti dalla cancellazione di altre attività. b) Se le condizioni concordate per quantità, qualità e tempi non sono rispettate dall\'Azienda, i costi aggiuntivi saranno a suo carico. c) Gli importi aggiuntivi saranno pagati con le stesse condizioni del preventivo principale.',
    },
    {
      title: '6. POST-PRODUZIONE E MONTAGGIO DELLE COPIE',
      text: 'La post-produzione e l\'edizione delle copie dei materiali prodotti o delle successive versioni sono, in linea di principio, fornite dal Produttore. Nel caso in cui l\'Azienda desideri consultare un terzo o gestire direttamente il lavoro, deve informare il Produttore delle condizioni ottenute e affidare il lavoro al Produttore, a condizione che quest\'ultimo si impegni a garantire condizioni economiche equivalenti o migliori. Se l\'Azienda decide di gestire la post-produzione o di affidarla a un terzo, il Produttore sarà esonerato dall\'obbligo di supervisione e non sarà più responsabile della garanzia di esecuzione del lavoro.',
    },
    {
      title: '7. PROPRIETÀ E CONSERVAZIONE DEI MATERIALI ORIGINALI',
      text: 'La proprietà dei master digitali è trasferita all\'Azienda solo dopo il pagamento completo al Produttore. Se il Produttore è responsabile della post-produzione, si occuperà della conservazione dei master digitali e degli elementi audio di mixaggio. In caso contrario, l\'Azienda dovrà provvedere immediatamente al ritiro di tali materiali. Trascorso un periodo di 1 mese, se il Produttore non è responsabile della post-produzione, l\'Azienda sarà tenuta a gestire tali materiali, e il Produttore avrà facoltà di non assicurare la conservazione di essi. Se il Produttore è responsabile della post-produzione, trascorso un periodo di 1 mese dall\'approvazione di tutti i master del progetto, l\'Azienda sarà tenuta a gestire tali materiali, e il Produttore avrà facoltà di non assicurare la conservazione di essi.',
    },
    {
      title: '8. PROPRIETÀ INTELLETTUALE',
      text: 'Soggetto al pagamento completo, il Produttore cede all\'Azienda i diritti di riproduzione e rappresentazione dei materiali prodotti, per la durata, i territori e i mezzi di comunicazione coperti dal preventivo. Il Produttore cede inoltre all\'Azienda, alle stesse condizioni, il diritto di adattamento dei materiali prodotti, esclusivamente per il rimontaggio e la modifica del pack-shot, nel rispetto delle norme sui diritti morali. I diritti ceduti includono anche quelli del regista. I diritti sulla musica, se il Produttore ne è responsabile, verranno ceduti all\'azienda alle stesse condizioni. Qualsiasi uso di immagini fisse, incluse quelle per pubblicità su stampa o altri media, così come l\'uso separato di personaggi o ambienti grafici creati per i materiali prodotti, sarà soggetto alla previa autorizzazione scritta del Produttore.',
    },
    {
      title: '9. DIRITTI DI TERZI',
      text: 'a) Salvo diversa indicazione nel preventivo: i diritti musicali e i diritti relativi a modelli, interpreti e oggetti forniti o imposti dall\'Azienda stessa sono negoziati direttamente dall\'Azienda; tutti gli elementi (persone, mobili, edifici) utilizzati nel/i film, la cui riproduzione e uso comporterebbero il pagamento di un compenso oltre il primo anno di sfruttamento o oltre i territori specificati nel preventivo, saranno soggetti alla previa approvazione dell\'Azienda. b) Escludendo questi elementi, il Produttore si impegna a fornire i materiali prodotti liberi da diritti per lo sfruttamento specificato nel preventivo, conformemente alla legislazione vigente. c) Il Produttore terrà indenne l\'Azienda da qualsiasi azione legale intentata da terzi in relazione alla distribuzione dei materiali prodotti, nella misura in cui tali azioni siano imputabili a elementi di responsabilità del Produttore, a condizione che lo sfruttamento avvenga nei limiti del preventivo e delle condizioni legali. d) L\'Azienda, dal canto suo, terrà indenne il Produttore da qualsiasi azione legale derivante dalla riproduzione o uso di elementi di responsabilità dell\'Azienda, inclusi script, storyboard, mood-board o altri materiali forniti.',
    },
    {
      title: '10. PAGAMENTO DEI DIRITTI RELATIVI ALL\'UTILIZZO DEI MATERIALI PRODOTTI',
      text: 'L\'Azienda pagherà ai vari titolari dei diritti a, ma non limitati a, interpreti, modelli, compositori, musicisti o altre terze parti, le somme a cui hanno diritto per lo sfruttamento dei materiali prodotti su un determinato supporto, in conformità alle leggi applicabili. L\'Azienda si farà inoltre carico del pagamento a qualsiasi organizzazione o azienda che possa essere beneficiaria di un contratto accettato dalla Società che stabilisce le condizioni finanziarie per lo sfruttamento dei materiali prodotti in Italia e all\'estero.',
    },
    {
      title: '11. IMPEGNI DEL PRODUTTORE',
      text: 'a) Rispetto dello scenario: salvo modifiche successivamente approvate, il Produttore dovrà consegnare i materiali prodotti secondo i documenti (sinossi, sceneggiature, storyboard e/o montaggio delle scene) approvati al termine dell\'ultimo incontro di pre-produzione. L\'Azienda provvederà, a questo proposito, a redigere sistematicamente i verbali delle riunioni, in particolare per quelle di pre-produzione. b) Segretezza professionale: il Produttore si impegna a non divulgare né a consentire la divulgazione di alcuna informazione sui materiali prodotti e sulla loro produzione senza il permesso espresso dell\'Azienda. c) Qualità del lavoro e conformità: il Produttore si impegna a garantire che i materiali prodotti siano di livello sufficiente di qualità e rispettino gli standard tecnici e le modalità di sfruttamento concordate tra le parti. Tuttavia, il produttore non potrà essere ritenuto responsabile per l\'accettazione finale o il rifiuto da parte dei comitati di visione dell\'ARPP o di qualsiasi altra organizzazione consultata in base alla natura dei media su cui i materiali prodotti saranno distribuiti. Il Produttore non potrà essere ritenuto responsabile per alcuna delle normative pubblicitarie (legge Evin, pubblicità ingannevole, ecc.) o per eventuali interferenze con i diritti dei concorrenti (pubblicità comparativa, concorrenza sleale, ecc.). d) Rispetto delle date di consegna: il Produttore e l\'Azienda devono rispettare il programma e, in particolare, le date di consegna e validazione, che si intendono imperative. Per quanto riguarda i ritardi nella validazione, in caso di mancata risposta, gli elementi inviati si considereranno validati. Se l\'Azienda decidesse di posticipare la data di consegna o di rinviare la consegna del master, il Produttore avrà diritto a fatturare, alla data inizialmente prevista nel programma, il saldo per i materiali prodotti, al netto dei costi di finitura non già impegnati. e) Ritardi dovuti a forza maggiore: se, per causa di forza maggiore indipendente dalla volontà del Produttore, lo stesso non riuscisse a consegnare il/i film nei tempi previsti, il ritardo non costituirà inadempimento del contratto tra il Produttore e l\'Azienda. Tuttavia, in questo caso, se si stabilisce che il ritardo elimina la necessità di ulteriori lavori, l\'Azienda potrà decidere di abbandonare la produzione in conformità con l\'Articolo 13 sottostante. f) Problemi dovuti al meteo (clausola "giorno meteorologico"): il rischio non rientra nelle responsabilità del Produttore. I costi aggiuntivi effettivi dovuti alle condizioni meteo, inclusa la quota di spese generali prevista nei preventivi dei "giorni meteorologici", senza margine di ricarico, saranno sostenuti dall\'Azienda. g) Come richiesto, anche se i costi relativi alle misure sanitarie da adottare sono a carico dell\'Agenzia o dell\'Inserzionista, il Produttore conferma di essere l\'unico responsabile della sicurezza dei suoi dipendenti durante le riprese.',
    },
    {
      title: '12. LIMITAZIONE DELLA RESPONSABILITÀ',
      text: 'Se il produttore non è in grado, per qualsiasi motivo, di adempiere a tutte le proprie obbligazioni, tutti i danni e gli interessi che possano derivarne, come tali, per l\'agenzia o l\'inserzionista saranno espressamente limitati al 100% dell\'importo del preventivo al netto dell\'IVA.',
    },
    {
      title: '13. RIFIUTO',
      text: 'Il mancato rispetto dello scenario o degli standard tecnici di cui all\'Articolo 10 può comportare il rifiuto dei materiali prodotti o di qualsiasi sequenza dei materiali prodotti da parte dell\'Azienda. L\'Azienda avrà il periodo specificato nel programma o, in mancanza, un ritardo di 8 giorni dopo ogni trasmissione o consegna per comunicare eventuali rifiuti. In caso contrario, la trasmissione o la consegna o gli elementi saranno considerati accettati. In caso di rifiuto da parte dell\'Azienda, il contratto non sarà automaticamente risolto, ma il Produttore dovrà procedere il prima possibile con le modifiche necessarie affinché i materiali prodotti siano conformi al contratto. I costi aggiuntivi di queste modifiche dovranno essere sostenuti dal Produttore.',
    },
    {
      title: '14. CANCELLAZIONE',
      text: 'La cancellazione da parte dell\'Azienda, dopo la validazione del preventivo, dà diritto ai seguenti benefici: a) Le spese sostenute dal Produttore fino alla data di cancellazione saranno completamente rimborsate, previa presentazione di documenti giustificativi, così come le spese generali e il margine corrispondente. Per spese sostenute si intendono salari, indennità, relative imposte, forniture, impegni irrevocabili, inclusa la retribuzione totale del regista, del direttore della fotografia, del produttore e del responsabile della produzione. b) Per quanto riguarda le troupe tecniche, gli artisti e i lavoratori che dovevano lavorare solo durante le riprese, la cancellazione da parte della Società dà diritto ai seguenti benefici: se la cancellazione viene comunicata al Produttore più di tre giorni lavorativi prima dell\'inizio delle riprese: nessuna compensazione aggiuntiva, salvo quanto diversamente specificato nelle condizioni; se la cancellazione viene comunicata al Produttore tre giorni lavorativi o meno prima dell\'inizio delle riprese: il 50% dei salari e delle imposte sul lavoro, nonché il relativo margine e spese generali; se la cancellazione viene comunicata un giorno lavorativo o meno prima dell\'inizio delle riprese: il 100% dei salari e delle imposte sul lavoro, nonché il relativo margine e spese generali. L\'espressione "Inizio delle riprese" si intende il primo giorno di "pre-light" o, se non è previsto il "pre-light", il primo giorno delle riprese. Per i materiali prodotti senza riprese (cioè film d\'animazione), il primo giorno di produzione è considerato come "inizio delle riprese".',
    },
    {
      title: '15. COMUNICAZIONE',
      text: 'Non appena inizia la distribuzione dei materiali prodotti, il Produttore può: presentare i materiali prodotti in qualsiasi proiezione, in modo non commerciale, in luoghi come festival, esposizioni professionali, eventi informativi o culturali; riprodurre i materiali prodotti nel suo demo reel, nel suo sito, in quello dei suoi agenti o in uno spazio dedicato su Internet, e autorizzare il regista a fare lo stesso. Il Produttore terrà indenne l\'Azienda da qualsiasi azione legale da parte di terzi relativa allo sfruttamento effettuato ai sensi della presente clausola.',
    },
    {
      title: '16. LEGGE APPLICABILE E GIURISDIZIONE',
      text: 'Il contratto tra il Produttore e l\'Azienda è soggetto alla legge Italiana. Le parti concordano che ogni controversia riguardante la validità, l\'esecuzione o l\'interpretazione di questo contratto sarà sottoposta ai tribunali competenti.',
    },
  ];
}

El despliegue se completó correctamente en Avalanche Fuji Testnet.

Pero hay un detalle importante: en los logs parece que hay dos contratos con nombres/direcciones cruzados.

En los logs iniciales aparece:

PaymentAttestation: 0xdA7d3e405336Fa81B555A21ca65C233D71e734AC
LoanReceiptNFT: 0xFFc9aB019feaa6A51743eB1ec581A13A9c03717d

Pero después Forge muestra:

LiquidationEngine → 0xdA7d3e405336Fa81B555A21ca65C233D71e734AC
PaymentAttestation → 0xFFc9aB019feaa6A51743eB1ec581A13A9c03717d

Eso normalmente significa una de estas dos cosas:

Los console.log en Deploy.s.sol tienen etiquetas equivocadas, o
Las variables se están asignando en un orden incorrecto.

Importante
Se modifica solamente desde el codigo no hace falta Desploy nuevo
const { Actor } = require('apify');
const { PuppeteerCrawler } = require('crawlee');

// Define el Actor
Actor.main(async () => {
    // Obtener los datos de entrada (puedes personalizar la URL de inicio)
    const input = await Actor.getInput() || { startUrls: [{ url: 'https://loterianacional.gob.do/' }] };
    const { startUrls } = input;

    // Crear el request queue
    const requestQueue = await Actor.openRequestQueue();

    // Agregar las URLs iniciales al queue
    for (const url of startUrls) {
        await requestQueue.addRequest({ url: url.url });
    }

    // Configurar el crawler con Puppeteer
    const crawler = new PuppeteerCrawler({
        requestQueue,
        launchContext: {
            launchOptions: {
                headless: true, // Ejecutar en modo headless
                defaultViewport: { width: 1280, height: 720 },
            },
        },
        requestHandler: async ({ page, request }) => {
            console.log(`Scraping: ${request.url}`);

            // Esperar a que la página cargue completamente
            await page.waitForSelector('.container', { timeout: 30000 })
                .catch(() => console.log('No se encontró el contenedor principal'));

            // Extraer datos de los sorteos
            const results = await page.evaluate(() => {
                const bancas = {
                    tarde: [],
                    noche: []
                };
                const billetesYQuinielas = [];
                
                // Función para determinar si es un sorteo de bancas
                const esSorteoBancas = (titulo) => {
                    return titulo.toLowerCase().includes('banca') || titulo.toLowerCase().includes('loteka') || titulo.toLowerCase().includes('leidsa');
                };
                
                // Función para determinar si es sorteo de tarde o noche
                const esSorteoTarde = (titulo) => {
                    return titulo.toLowerCase().includes('tarde') || titulo.toLowerCase().includes('primera') || titulo.toLowerCase().includes('1ra');
                };
                
                // Buscar secciones de resultados en la página
                const sorteoSections = document.querySelectorAll('.sorteo-section, .resultados-section, .numeros-section, table');
                
                sorteoSections.forEach(section => {
                    const tituloElement = section.querySelector('h2, h3, .titulo-sorteo, .titulo, caption') || section.closest('section')?.querySelector('h2, h3, .titulo-sorteo');
                    const titulo = tituloElement ? tituloElement.innerText.trim() : 'Sorteo';
                    
                    const fechaElement = section.querySelector('.fecha-sorteo, .date') || section.closest('section')?.querySelector('.fecha-sorteo, .date');
                    const fecha = fechaElement ? fechaElement.innerText.trim() : new Date().toLocaleDateString();
                    
                    // Extraer números y premios
                    const numerosElements = section.querySelectorAll('.numero-ganador, .bola, .numero, td');
                    const numeros = [];
                    let primerPremio = 'No disponible';
                    let segundoPremio = 'No disponible';
                    let tercerPremio = 'No disponible';
                    
                    numerosElements.forEach((element, index) => {
                        const numero = element.innerText.trim();
                        if (numero.match(/\d+/)) {
                            if (esSorteoBancas(titulo)) {
                                numeros.push(numero);
                            } else {
                                switch(index) {
                                    case 0: primerPremio = numero; break;
                                    case 1: segundoPremio = numero; break;
                                    case 2: tercerPremio = numero; break;
                                    default: numeros.push(numero);
                                }
                            }
                        }
                    });
                    
                    // Si no hay números específicos, intentar extraer del texto
                    if (numeros.length === 0) {
                        const texto = section.innerText;
                        const numerosMatch = texto.match(/\d+/g);
                        if (numerosMatch) {
                            numeros.push(...numerosMatch);
                        }
                    }
                    
                    // Crear el objeto de resultado según el tipo de sorteo
                    if (esSorteoBancas(titulo)) {
                        const resultado = {
                            fecha: fecha,
                            tipoSorteo: titulo,
                            numero: numeros.join(', ') || 'No disponible'
                        };
                        
                        if (esSorteoTarde(titulo)) {
                            bancas.tarde.push(resultado);
                        } else {
                            bancas.noche.push(resultado);
                        }
                    } else {
                        billetesYQuinielas.push({
                            fecha: fecha,
                            sorteo: titulo,
                            primerPremio: primerPremio,
                            segundoPremio: segundoPremio,
                            tercerPremio: tercerPremio
                        });
                    }
                });
                
                // Si no se encontró ningún dato, crear registros genéricos
                if (bancas.tarde.length === 0 && bancas.noche.length === 0 && billetesYQuinielas.length === 0) {
                    bancas.tarde.push({
                        fecha: new Date().toLocaleDateString(),
                        tipoSorteo: 'Bancas (Tarde)',
                        numero: 'No disponible'
                    });
                    bancas.noche.push({
                        fecha: new Date().toLocaleDateString(),
                        tipoSorteo: 'Bancas (Noche)',
                        numero: 'No disponible'
                    });
                    billetesYQuinielas.push({
                        fecha: new Date().toLocaleDateString(),
                        sorteo: 'Lotería Nacional',
                        primerPremio: 'No disponible',
                        segundoPremio: 'No disponible',
                        tercerPremio: 'No disponible'
                    });
                }
                
                return { bancas, billetesYQuinielas };
            });

            console.log('Resultados extraídos:', JSON.stringify(results, null, 2));
            
            // Guardar los resultados en el dataset
            await Actor.pushData(results);
        },
        maxRequestsPerCrawl: 10, // Límite de requests para evitar sobrecarga
        failedRequestHandler: async ({ request }) => {
            console.log(`Request failed: ${request.url}`);
        },
    });

    // Ejecutar el crawler
    await crawler.run();

    console.log('Scraping completado');
});
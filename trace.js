const { Command } = require('commander')
const Traceroute = require('nodejs-traceroute')
const isValidDomain = require('is-valid-domain')
const isip = require('isipaddress')
const country = require('country-list');
const axios = require('axios')
const dns = require('dns')
const util = require('util')
const lookup = util.promisify(dns.lookup)

const main = async () => {
  try {
    const program = new Command()
    program.version('0.0.1')

    program.argument('<destination>', 'Destination', (destination) => {
      if (isValidDomain(destination) || isip.test(destination)) {
        return destination
      } else {
        throw new Error('Destination Error')
      }
    })
    program.action(async (destination) => {
      // Resolve IP
      let ip = ''
      let domain = ''
      if (isValidDomain(destination)) {
        let result = await lookup(destination)
        ip = result.address
        domain = destination
      }
      if (isip.test(destination)) {
        ip = destination
      }

      // Trace
      const tracer = new Traceroute();
      tracer.on('destination', (dest) => {
        console.log()
        if (domain) {
          console.log(`Tracing route to ${domain} [${dest}]`);
        } else {
          console.log(`Tracing route to [${dest}]`);
        }
        console.log('over a maximum of 30 hops:')
        console.log()
      })
      tracer.on('hop', async (hop) => {
        try{
          const getGeoInfo = async (ip) => {
            const isLocalIP = (ip) => {
              const getIpNum = (ip) => {
                ip = ip.split('.');
                let a = parseInt(ip[0]);
                let b = parseInt(ip[1]);
                let c = parseInt(ip[2]);
                let d = parseInt(ip[3]);
                let ipNum = a * 256 * 256 * 256 + b * 256 * 256 + c * 256 + d;
                return ipNum;
              }
  
              const isInner = (userIp, begin, end) => {
                return (userIp >= begin) && (userIp <= end);
              }
  
              let isInnerIp = false;//默认给定IP不是内网IP      
              let ipNum = getIpNum(ip);
              let aBegin = getIpNum('10.0.0.0')
              let aEnd = getIpNum('10.255.255.255')
              let bBegin = getIpNum('172.16.0.0')
              let bEnd = getIpNum('172.31.255.255')
              let cBegin = getIpNum('192.168.0.0')
              let cEnd = getIpNum('192.168.255.255')
              let dBegin = getIpNum('127.0.0.0')
              let dEnd = getIpNum('127.255.255.255')
              isInnerIp = isInner(ipNum, aBegin, aEnd) || isInner(ipNum, bBegin, bEnd) || isInner(ipNum, cBegin, cEnd) || isInner(ipNum, dBegin, dEnd)
              return isInnerIp;
            }
  
            if (isLocalIP(ip) === false) {
              try{
                let url = `https://ipinfo.io/${ip}/geo`
                let response = await axios.get(url)
                let geoinfo = response.data
                let result = ''
                if (geoinfo.city === geoinfo.region) {
                  result = `${geoinfo.city}/${country.getName(geoinfo.country)}`
                } else {
                  result = `${geoinfo.city}/${geoinfo.region}/${country.getName(geoinfo.country)}`
                }
                return result
              }catch(error){
                return ''
              }
            } else {
              return 'local'
            }
          }
          let geo = await getGeoInfo(hop.ip)
          let IPAddress = hop.ip
          let index = hop.hop.toString()
          let rtt1 = hop.rtt1.toString().replace(' ', '')
          let rtt2 = hop.rtt2.replace(' ', '')
          let rtt3 = hop.rtt3.replace(' ', '')
          if(hop.ip !== 'Request timed out.'){
            console.log(` ${index}    ${rtt1}   ${rtt2}   ${rtt3}   ${IPAddress}   ${geo}`)
          }else{
            console.log(` ${index}    ${rtt1}   ${rtt2}   ${rtt3}`)
          }
        }catch(error){
          console.error(error.message)
        }
      })
      //tracer.on('close', () => {
      //});

      tracer.trace(ip);
    })
    await program.parseAsync(process.argv)

  } catch (error) {
    console.error(error)
  }
}

main()